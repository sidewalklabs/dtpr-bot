// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

const functions = require('firebase-functions');
const {
  WebhookClient,
  Card,
  Suggestion,
  Payload
} = require('dialogflow-fulfillment');
const Airtable = require('airtable');
const base = new Airtable({
  apiKey: 'keyZsWLtuGKax2Dro'
}).base('appe5T5foKvONA32l');

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({
    request,
    response
  });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  const getChildComponents = component => {
    const children = component.get('Child components');
    if (!children || !children.length) return children;
    return Promise.all(children.map(id => base('Components').find(id)));
  };

  function welcome(agent) {
    agent.add('Hi I can provide information to you about technology is being used in building and spaces. What place do you want to talk about?');
    const {
      startingIntent
    } = agent.originalRequest.payload;
    if (typeof startingIntent !== 'undefined' && startingIntent !== '') {
      console.log(`Starting Intent --> ${startingIntent}. Skipping Default Welcome & attempting to trigger starting intent.`);
      agent.setFollowupEvent(startingIntent);
    }
  }

  /*
   * Return the componentId to be used as the base context for queries
   * If a 'component-context' exists use it.
   * Otherwise use the component context from the original request
   * If neither is available return null
   */
  const getComponentId = agent => {
    console.log('=======> getComponentId()...');
      const componentContext = agent.getContext('component-context');
      const incomingComponentId = componentContext ? componentContext.parameters.componentId : null;
      const originalContext = agent.originalRequest.payload;
      console.log('=======> componentContext = ', JSON.stringify(componentContext, null, 2));
    console.log('=======> incomingComponentId = ', JSON.stringify(incomingComponentId, null, 2));
    console.log('=======> originalContext = ', JSON.stringify(originalContext, null, 2));
    const {
        componentId: originalComponentId
      } = originalContext;
      console.log('=======> originalComponentId = ', JSON.stringify(originalComponentId, null, 2));
    const usingId = incomingComponentId ? 'Incoming Id' : 'Original Request Id';
    console.log('=======> Which id are we using?: ', usingId);
      const id = incomingComponentId || originalComponentId;
    console.log('=======> id: ', id);
      return id;
    };

  function learnAboutComponent(agent) {
    const originalContext = agent.originalRequest.payload;
    const {
      componentId,
      placeId
    } = originalContext;
    console.log('Original Context: ', JSON.stringify(originalContext));
    agent.add('Let me take a look for the information about this component.');
    return base('Components').find(componentId)
      .then(component => {
        const {
          id
        } = component;
        const name = component.get('Name');
        agent.add(`This is a ${name}.`);
        return base('Places').find(placeId);
      })
      .then(place => {
        const name = place.get('Name');
        agent.add(`It's installed at ${name}. I can also tell you more about it and how the data is being handled.`);
        agent.add(new Suggestion('What is it?'));
        agent.add(new Suggestion('Why is it here?'));
        agent.add(new Suggestion('How long is the data kept?'));
        agent.add(new Suggestion('Where is the data stored?'));
        agent.add(new Suggestion('Who has access to the data?'));
        agent.add(new Suggestion('How is the data protected?'));
        agent.add(new Suggestion('How can I give feedback about this?'));
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });


    // agent.add(`Get details about componentId: ${originalContext.componentId} at placeId: ${originalContext.placeId}`);
  }

  function getDescription(agent) {
    console.log('getDescription()...');
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        const description = component.get('Description');
        agent.add(description);
		return getTheParts(agent);
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });
  }

  function getWhy(agent) {
    console.log('getWhy()...');
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        const info = component.get('Purpose');
        return Promise.all(info.map(id => base('Purpose').find(id)));
      })
      .then(purposes => {
        const names = purposes.map(purpose => purpose.get('Name'));
        const purposeStr = names.length > 1 ? 'purposes' : 'purpose';
        const areIsStr = names.length > 1 ? 'are' : 'is';
        agent.add(`The ${purposeStr} of this component ${areIsStr} ${names.join(',')}`);
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });
  }
  const getTimeRetained = () => {
    console.log('getTimeRetained()...');
    return getStorageData('retention');
  };

  const getStorage = () => {
    console.log('getStorage()...');
    return getStorageData('storage');
  };

  const getStorageData = (dataType) => {
    console.log('getStorageData() type = ', dataType);
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        const info = component.get('Storage');
        if (!info) {
          agent.add(`This component doesn't appear to have storage information to share.`);
          throw new Error(`Storage info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return Promise.all(info.map(id => base('Storage').find(id)));
      })
      .then(storageInfo => {
        //console.log(storageInfo);
        const names = storageInfo.map(storage => {
          console.log(`Storage Type: ${storage.get(dataType)}`);
          console.log(`Storage Name: ${storage.get('Name')}`);
          if (storage.get('PropertyType') === dataType) {
            return storage.get('Description');
          }
        }).filter(name => name);
        agent.add(`The data is ${names.join(',').toLowerCase()}.`);
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });
  };

  const getAccess = agent => {
    console.log('getAccess()...');
    const dataType = 'Description';
    const infoType = 'Access';
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        const info = component.get(infoType);
        if (!info) {
          agent.add(`This component doesn't appear to have ${infoType} information to share.`);
          throw new Error(`${infoType} info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return Promise.all(info.map(id => base(infoType).find(id)));
      })
      .then(info => {
        const items = info.map(item => item.get(dataType))
          .filter(item => item);
        agent.add(items.join(' '));
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });
  }

  const getAccountability = () => {
    console.log('getAccountability()...');
    const dataType = 'name';
    const infoType = 'Accountability';
    const originalContext = agent.originalRequest.payload;
    // ** NO CONTEXT SWTICHING ABILITY FOR PLACE ATM **
    const {
      placeId,
      componentId
    } = originalContext;
    return base('Places').find(placeId)
      .then(place => {
        const accountabilityId = place.get('Accountable Entity')[0];
        if (!accountabilityId) {
          agent.add(`This component doesn't appear to have ${infoType} information to share.`);
          throw new Error(`${infoType} info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return base('Accountability').find(accountabilityId);
      })
      .then(accountableEntity => {
        const name = accountableEntity.get('Name');
        const logoUrl = accountableEntity.get('Logo')[0].thumbnails.large.url;
        const organizationUrl = accountableEntity.get('Accountable Organization URL');
        const description = accountableEntity.get('Description');

        agent.add(`${name} is accountable for it.`);
        agent.add(new Card({
          title: name,
          imageUrl: logoUrl,
          text: description,
          buttonText: 'Visit',
          buttonUrl: organizationUrl
        }));
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });
  };
  const capitalizeString = s => {
    return s && s[0].toUpperCase() + s.slice(1);
  };
  const titleCase = str => {
    if (str != '') return str.replace(/(^[a-z])|(\s+[a-z])/g, txt => txt.toUpperCase());
    return '';
  };
  const ENTITIES = {
    PLACE_ATTRACTION: 'place-attraction',
    LOCATION: 'location',
    COMPONENT: 'component',
    SYSTEM: 'system',
    PURPOSE: 'Purpose',
    ADDRESS: 'address',
    TECHNOLOGY_TYPE: 'technology-type',
    DATA_PROCESS: 'data-process',
    DATA_TYPE: 'data-type'
  };

  // inpsect parameters to decide which entity type the user is talking about
  // organized in terms of prirotiy for simplicties sake (we are not trying to
  // handle relationships between entities)
  const getPrimaryEntityType = (parameters) => {
    const placeattraction = parameters['place-attraction'];
    const dataprocess = parameters['data-process'];
    const technologytype = parameters['technology-type'];
    const datatype = parameters['data-type'];
    const {
      location,
      component,
      Purpose,
      address,
      system
    } = parameters;
    // order of priorty
    if (system) return ENTITIES.SYSTEM;
    if (placeattraction) return ENTITIES.PLACE_ATTRACTION;
    if (location) return ENTITIES.LOCATION;
    if (component) return ENTITIES.COMPONENT;
    if (Purpose) return ENTITIES.PURPOSE;
    if (dataprocess) return ENTITIES.DATA_PROCESS;
    if (datatype) return ENTITIES.DATA_TYPE;
    if (technologytype) return ENTITIES.TECHNOLOGY_TYPE;
    if (address) return ENTITIES.ADDRESS;
    return;
  };

  const mapEntityToInfo = (type) => {
    console.log('mapEntityToInfo ===> ', type);
    const map = {
      base: null,
      property: null,
      identifier: null
    };
    switch (type) {
      case ENTITIES.PLACE_ATTRACTION:
        map.base = 'Places';
        map.property = 'Description';
        map.identifier = 'Name';
        map.prepend = '';
        break;
      case ENTITIES.LOCATION:
      case ENTITIES.ADDRESS:
        map.base = 'Places';
        map.property = 'Description';
        map.identifier = 'Name';
        map.prepend = '';
        break;
      case ENTITIES.COMPONENT:
        map.base = 'Components';
        map.property = 'Technology Type';
        map.identifier = 'Name';
        map.prepend = 'It is a';
        map.joinTable = 'Technology Type';
        map.joinProperty = 'Name';
        break;
      case ENTITIES.SYSTEM:
        map.base = 'Components';
        map.property = 'Description';
        map.identifier = 'Name';
        map.prepend = '';
        break;
      case ENTITIES.PURPOSE:
        map.base = 'Purpose';
        map.property = 'Description';
        map.identifier = 'Name';
        map.prepend = 'This means it is';
        break;
      case ENTITIES.DATA_PROCESS:
        map.base = 'Data Process';
        map.property = 'Description';
        map.identifier = 'Name';
        map.prepend = '';
        break;
      case ENTITIES.DATA_TYPE:
        map.base = 'Data Type';
        map.property = 'Description';
        map.identifier = 'Name';
        map.prepend = '';
        break;
      case ENTITIES.TECHNOLOGY_TYPE:
        map.base = 'Technology Type';
        map.property = 'Description';
        map.identifier = 'Name';
        map.prepend = '';
        break;
    }
    return map;
  };

  const filterFirstPageByFormula = (formula, entityMap) => {
    return new Promise((resolve, reject) => {
      base(entityMap.base)
        .select({
          filterByFormula: formula
        })
        .firstPage((err, records) => {
          if (err) return reject(err);
          return resolve(records);
        });
    });
  };

  // Notice that whatIs does not use componentId but instead bases it's search on entities from the params
  // Notice also that whatIs is a place where the componentId will switch to the id of the selected system or component
  const whatIs = (agent) => {
    console.log('whatIs()...');
    const {
      parameters
    } = agent;
    console.log('parameters: ', parameters);
    const primaryEntity = getPrimaryEntityType(parameters);
    const entityMap = mapEntityToInfo(primaryEntity);
    console.log(`Q: What is ${parameters[primaryEntity]}? (${primaryEntity})`);
    const item = titleCase(parameters[primaryEntity]);
    console.log('item: ', item);
    const query = `{${entityMap.identifier}} = "${item}"`;
    console.log('entityMap: ', entityMap);
    console.log('query: ', query);
    return filterFirstPageByFormula(query, entityMap)
      .then(records => {
        console.log('response 1 recieved...', records);
        if (!records.length) {
          agent.add('I am not able to provide an answer to that question currently. I will take a note and look for the future.');
          throw new Error(`What Is intent with parameters ${parameters} could not resolve any information.`);
        }
        console.log('found records...');
        // record will be an id in the event of a join
        const record = records[0];
        // handle joins if any
        if (entityMap.joinTable) {
          console.log('retrive Join table...');
          return base(entityMap.joinTable).find(record.get(entityMap.property)[0]);
        }
        // otherwise pass record through
        console.log('pass record thru...');
        return record;
      })
      .then(record => {
        console.log('got Join tbale response...');
        const answer = entityMap.joinTable ? record.get(entityMap.joinProperty) : record.get(entityMap.property);
        const message = `${entityMap.prepend} ${answer}.`;
        console.log('agent message: ', message);
        if (primaryEntity === ENTITIES.SYSTEM || primaryEntity === ENTITIES.COMPONENT) {
          console.log('*** Setting the context to a new component ***');
          const context = { 'name': 'component-context', 'lifespan': 5, 'parameters': { 'componentId': record.get('ID') } };
          agent.setContext(context);
          //agent.setContext({'name': 'component-context', 'lifespan': 2, 'parameters': {'city': 'Rome'}});
        }
        agent.add(message);
        // is it a system and does it have subsystems
        const childComponentIds = record.get('Child components');
        if (primaryEntity === 'system' && childComponentIds && childComponentIds.length > 0) return getChildComponents(record);
        return;
      })
      .then(records => {
        if (!records || !records.length) return;
        agent.add('You can learn more about the components that make up the system.');
        records.forEach(component => agent.add(new Suggestion(component.get('Name'))));
      })
      .catch(console.error);
  };
  const addAndToLastElement = list => {
    if (list.length > 1) {
      list[list.length - 1] = `and ${list[list.length - 1]}`;
    }
    return list;
  };
  const getDataProcessList = () => {
    console.log('getDataProcessList()...');
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        const info = component.get('Data Process');
        if (!info) {
          agent.add(`This component doesn't appear to have Data Process information to share.`);
          throw new Error(`Data Process info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return Promise.all(info.map(id => base('Data Process').find(id)));
      })
      .then(info => {
        const names = info.map(dataProcess => dataProcess.get('Name')).filter(name => name);
        const list = addAndToLastElement(names);
        agent.add(`The data is handled using ${list.join(', ')} data processes.`);
        // add suggestion chips
        names.forEach(name => agent.add(new Suggestion(`What does ${name} mean?`)));
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });
  };
  const getDataTypes = () => {
    console.log('getDataTypesList()...');
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        const info = component.get('Data Type');
        if (!info) {
          agent.add(`This component doesn't appear to have Data Type information to share.`);
          throw new Error(`Data Type info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return Promise.all(info.map(id => base('Data Type').find(id)));
      })
      .then(info => {
        console.log('STEP 2 ---> ', info);
        const names = info.map(dataType => dataType.get('Name')).filter(name => name);
        console.log('STEP 2 ---> names: ', names);
        const list = addAndToLastElement([...names]);
        agent.add(`The data collected is stored as ${list.join(', ')}.`);
        // add suggestion chips
        names.forEach(name => agent.add(new Suggestion(`What does ${name} mean?`)));
      })
      .catch(reason => {
        console.log('ERROR: ', reason);
      });
  };
  const whereAmI = () => {
    console.log('whereAmI()...');
    const originalContext = agent.originalRequest.payload;
    if (!originalContext) throw new Error('User requests location but original context was not passed.');
    const {
      placeId
    } = originalContext;
    return base('Places').find(placeId)
      .then(place => {
        if (!place) throw new Error(`where am I intent was passed placeId: ${placeId} but no place data could be loaded.`);
        agent.add(place.get('Headline'));
      });
  };

  const getTheParts = agent => {
    console.log('getTheParts()...');
    const componentId = getComponentId(agent);
    // does it have child components? return a list of those
    return base('Components').find(componentId)
      .then(getChildComponents)
      .then(children => {
        if (!children || !children.length) return agent.add('It is a simple technology it does not have any child components or systems to describe.');
        const names = children.map(child => child.get('Name')).filter(name => name);
        agent.add(`This technology has ${children.length} sub-components. You can learn more about them.`);
        // add suggestion chips
        names.forEach(name => agent.add(new Suggestion(name)));
      })
      .catch(console.error);
  };

  const getTargetOutcome = () => {
    console.log('getTargetOutcome()...');
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        if (!component) throw new Error(`A component with id: ${componentId} could not be found.`);
        const targetOutcome = component.get('Target Outcome');
        if (!targetOutcome) return agent.add('There is currently no target benefit for this component');
        return agent.add(`${targetOutcome}`);
      })
      .catch(console.error);
  };

  const getMeasuredOutcome = () => {
    console.log('getMeasuredOutcome()...');
    const componentId = getComponentId(agent);
    return base('Components').find(componentId)
      .then(component => {
        if (!component) throw new Error(`A component with id: ${componentId} could not be found.`);
        const targetOutcome = component.get('Measured Outcome');
        if (!targetOutcome) return agent.add('There is currently no measured outcome listed for this component');
        return agent.add(`It has achieved ${targetOutcome}`);
      })
      .catch(console.error);
  };

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  // // Uncomment and edit to make your own intent handler
  // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function yourFunctionHandler(agent) {
  //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
  //   agent.add(new Card({
  //       title: `Title: this is a card title`,
  //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
  //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
  //       buttonText: 'This is a button',
  //       buttonUrl: 'https://assistant.google.com/'
  //     })
  //   );
  //   agent.add(new Suggestion(`Quick Reply`));
  //   agent.add(new Suggestion(`Suggestion`));
  //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
  // }

  // // Uncomment and edit to make your own Google Assistant intent handler
  // // uncomment `intentMap.set('your intent name here', googleAssistantHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function googleAssistantHandler(agent) {
  //   let conv = agent.conv(); // Get Actions on Google library conv instance
  //   conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
  //   agent.add(conv); // Add Actions on Google library responses to your agent's response
  // }
  // // See https://github.com/dialogflow/fulfillment-actions-library-nodejs
  // // for a complete Dialogflow fulfillment library Actions on Google client library v2 integration sample

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('learn about component', learnAboutComponent);
  intentMap.set('get description', getDescription);
  intentMap.set('get why', getWhy);
  intentMap.set('get time retained', getTimeRetained);
  intentMap.set('get storage', getStorage);
  intentMap.set('get access', getAccess);
  intentMap.set('get accountability', getAccountability);
  intentMap.set('what is', whatIs);
  intentMap.set('get data process list', getDataProcessList);
  intentMap.set('get data types', getDataTypes);
  intentMap.set('where am I', whereAmI);
  intentMap.set('get the parts', getTheParts);
  intentMap.set('get target outcome', getTargetOutcome);
  intentMap.set('get measured outcome', getMeasuredOutcome);

  //get child components

  // intentMap.set('your intent name here', yourFunctionHandler);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
