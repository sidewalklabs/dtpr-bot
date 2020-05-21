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
const apiKey = 'keyZsWLtuGKax2Dro'; // <-------- AIRTABLE API KEY
const baseId = 'appe5T5foKvONA32l'; // <-------- AIRTABLE BASE ID
const airtableBase = new Airtable({ apiKey }).base(baseId);

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

/*
 * Buffer a copy of Airtable Data to avoid timeouts on Airtable API requests
 */

const USE_LIVE_AIRTABLE_API_DATA = false;

const isValidTable = tableName => TABLES.includes(tableName);

/*
 * base sits as facade in front of the Airtable API base method.
 * In the case where the cached API Data is used the base method
 * operates on a cache of stored JSON data.
 */
const base = tableName => {
  if (USE_LIVE_AIRTABLE_API_DATA) return airtableBase(tableName);
  if (!isValidTable(tableName)) throw new Error('Base must be intialized with a valid table name such as: ', TABLES.join(', '));
  return {
    find: id => {
      if (!id) return Promise.resolve(AIRTABLE_DATA[tableName]);
      return Promise.resolve(AIRTABLE_DATA[tableName].find(record => record.get('ID') === id));
    }
  };
};

/*
 * Sits as facade in front of Airtable API select functionality
 * In the case where the cached API Data is to be used the
 * the select method hits and filters the local JSON store.
 * ARGS tableName name of the table to look at
 * ARGS filter An object with a props name & value to filter results
 */
const select = (tableName, filter) => {
  return new Promise(async (resolve, reject) => {
    if (!isValidTable(tableName)) return reject('Base must be intialized with a valid table name such as: ', TABLES.join(', '));
    if (filter && (!filter.name || !filter.value)) return reject('If a filter object is provided it must define name & value properties as strings.');
    let all;
    try {
      all = await getTable(tableName);
    } catch (reason) {
      return reject(reason);
    }
    if (!filter) return resolve(all);
    return resolve(all.filter(record => record.get(filter.name) === filter.value).filter(r => r));
  });
};

let AIRTABLE_DATA = {};

/*
 * All valid table names for the DTPR
 * Used for downloading the cache & for validating queries
 */
const TABLES = [
  'Places',
  'Components',
  'Accountability',
  'Purpose',
  'Technology Type',
  'Data Type',
  'Data Process',
  'Access',
  'Storage',
  'Connections'
];

/*
 * Methods used for downloading the Airtable API Data
 */
const getTable = tableName => {
  let arr = [];
  return new Promise((resolve, reject) => {
    airtableBase(tableName).select()
      .eachPage((records, fetchNextPage) => {
        arr = [...records];
        fetchNextPage();
      }, err => {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }
        resolve(arr);
      });
  });
 };

 const getAirtableData = async () => {
  console.log('===============> getAirtableData()...');
  try {
    const allArrays = await Promise.all(TABLES.map(name => getTable(name)));
    const output = {};
    allArrays.forEach((arr, idx) => output[TABLES[idx]] = arr);
    AIRTABLE_DATA = output;
    console.log('===============> *** AirtableData retrieved sucessfully ***');
    return output;
  } catch (reason) {
    console.error('===============> *** There was an error preloading the Airtable API Data. *** Reason: ', reason);
  }
};

/*
 * This method is an async fire & forget
 * It runs at deploy time.
 * It fetches a copy of the Airtable API data & stores it locally.
 */
getAirtableData();

/*
 * Map entity type string to constants
 */
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

/*
 * Store default/fallback IDs for use in requests. This is also useful while testing in the DF console.
 * This is b/c the base context IDs are passed in from the client host HTML pages
 */
const DEFAULTS = {
  placeId: 'recHJJkuqk0AYjHa9'
};

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({
    request,
    response
  });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));

  /*
   * Utility functions
   * These general purpose methods perform parsing tasks on incoming Airtable data
   * or manipulate DF state & context.
   */
  const getChildComponents = component => {
    const children = component.get('Child components');
    if (!children || !children.length) return children;
    return Promise.all(children.map(id => base('Components').find(id)));
  };

  /*
  * Store default/fallback IDs for use in requests. This is also useful while testing in the DF console.
  * This is b/c the base context IDs are passed in from the client host HTML pages
  */
  const getPayload = agent => agent.originalRequest.payload.userId ? JSON.parse(agent.originalRequest.payload.userId) : agent.originalRequest.payload;

  function welcome(agent) {
    console.log('WELCOME');
    console.log('===============> AT_DATA: ', JSON.stringify(AIRTABLE_DATA));
    agent.add('Hi I can provide information to you about technology is being used in building and spaces. What place do you want to talk about?');
    const payload = getPayload(agent);
    const { startingIntent } = payload;
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
    const componentContext = agent.getContext('component-context');
    const incomingComponentId = componentContext ? componentContext.parameters.componentId : null;
    const originalContext = getPayload(agent);
    const { componentId: originalComponentId } = originalContext;
    return incomingComponentId || originalComponentId;
  };

  /*
   * Get the placeId to use as the place context either from the
   * original passed context or use the default fallback
   */
  const getPlaceId = agent => {
    const originalContext = getPayload(agent);
    const { placeId } = originalContext;
    return placeId || DEFAULTS.placeId;
  };

  const capitalizeString = s => {
    return s && s[0].toUpperCase() + s.slice(1);
  };

  const titleCase = str => {
    if (str != '') return str.replace(/(^[a-z])|(\s+[a-z])/g, txt => txt.toUpperCase());
    return '';
  };

  const addAndToLastElement = list => {
    if (list.length > 1) {
      list[list.length - 1] = `and ${list[list.length - 1]}`;
    }
    return list;
  };

  /*
   * Return the entity type to be used as the main entity for a user request.
   * This is the best guess of the type of thing the user is mainly asking about.
   * The types are organized in terms of a rough semantic priority as it is
   * more than possible that multiple entity types will be retrieved.
   */
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

  /*
   * Return an object which describes a series of steps to query
   * for a particular entity type.
   * base: which table in the AIrtable to begin the query on
   * property: the column we are interested in for output OR to form a join in a subsequent step
   * identifier: This the column we use to select the row
   * joinTable: if this is defined we take the output from the first query and then query this table
   * joinProperty: This is the colum that becomes the eventual output of a join query
   * prepend: allows text to be passed that prepends the result in a message that is sent to the user
   * # there is no join identifier as queries are assumed to have a single join at maximum
   */
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

  /*
   * DF Intent Handlers
   * These are mapped to specific DF intents & that map is passed to the agent
   */
  function learnAboutComponent(agent) {
    const originalContext = getPayload(agent);
    const {
      componentId
    } = originalContext;
    if (!componentId) return noComponentFallback(agent);
    const placeId = getPlaceId(agent);
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
        return getQuestionsToAsk(agent);
      });
  }

  const learnAboutPlace = agent => {
    const placeId = getPlaceId(agent);
    return base('Places').find(placeId)
      .then(place => {
        const name = place.get('Name');
        agent.add(`Welcome to ${name}. I can help you learn about this place and the kind of systems we use here to help people.`);
        return getQuestionsToAsk(agent);
      });
  };

  function getDescription(agent) {
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
    return base('Components').find(componentId)
      .then(component => {
        const description = component.get('Description');
        agent.add(description);
        return getTheParts(agent);
      });
  }

  function getWhy(agent) {
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
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
      });
  }
  const getTimeRetained = () => getStorageData('retention');

  const getStorage = () => getStorageData('storage');

  const getStorageData = (dataType) => {
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
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
        const names = storageInfo.map(storage => {
          if (storage.get('PropertyType') === dataType) return storage.get('Description');
        }).filter(name => name);
        agent.add(names.join(' '));
      });
  };

  const getAccess = agent => {
    const dataType = 'Description';
    const infoType = 'Access';
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
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
      });
  };

  const getAccountability = agent => {
    const dataType = 'name';
    const infoType = 'Accountability';
    const originalContext = getPayload(agent);
    const {
      componentId
    } = originalContext;
    const placeId = getPlaceId(agent);
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
      });
  };

  // Notice that whatIs does not use componentId but instead bases it's search on entities from the params
  // Notice also that whatIs is a place where the componentId will switch to the id of the selected system or component
  const whatIs = (agent) => {
    const { parameters } = agent;
    const primaryEntity = getPrimaryEntityType(parameters);
    const item = titleCase(parameters[primaryEntity]);
    const entityMap = mapEntityToInfo(primaryEntity);
    const filter = { name: entityMap.identifier, value: capitalizeString(parameters[primaryEntity]) };
    return select(entityMap.base, filter)
      .then(records => {
        if (!records.length) {
          agent.add(`I cannot seem to find any information about the ${item} in my records.`);
        }
        // record will be an id in the event of a join
        const record = records[0];
        // handle joins if any
        if (entityMap.joinTable) {
          return base(entityMap.joinTable).find(record.get(entityMap.property)[0]);
        }
        // otherwise pass record through
        return record;
      })
      .then(record => {
        const answer = entityMap.joinTable ? record.get(entityMap.joinProperty) : record.get(entityMap.property);
        const message = `${entityMap.prepend} ${answer}.`;
        if (primaryEntity === ENTITIES.SYSTEM || primaryEntity === ENTITIES.COMPONENT) {
          const context = { 'name': 'component-context', 'lifespan': 5, 'parameters': { 'componentId': record.get('ID') } };
          agent.setContext(context);
        }
        agent.add(message);
        return;
      })
      .then(records => {
        if (!records || !records.length) return;
        return agent.add('You can learn more about the components that make up the system.');
        //records.forEach(component => agent.add(new Suggestion(component.get('Name'))));
      });
  };

  const getDataProcessList = () => {
    console.log('getDataProcessList()...');
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
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
      });
  };
  const getDataTypes = () => {
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
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
        const names = info.map(dataType => dataType.get('Name')).filter(name => name);
        const list = addAndToLastElement([...names]);
        agent.add(`The data collected is stored as ${list.join(', ')}.`);
        // add suggestion chips
        names.forEach(name => agent.add(new Suggestion(`What does ${name} mean?`)));
      });
  };
  const whereAmI = () => {
    const placeId = getPlaceId(agent);
    return base('Places').find(placeId)
      .then(place => {
        if (!place) throw new Error(`where am I intent was passed placeId: ${placeId} but no place data could be loaded.`);
        agent.add(place.get('Headline'));
      });
  };

  const getTheParts = agent => {
    const componentId = getSystems(agent);
    // does it have child components? return a list of those
    if (!componentId) return noComponentFallback(agent);
    return base('Components').find(componentId)
      .then(getChildComponents)
      .then(children => {
        if (!children || !children.length) return agent.add('It is a simple technology it does not have any child components or systems to describe.');
        const names = children.map(child => child.get('Name')).filter(name => name);
        const list = addAndToLastElement([...names]).join(', ');
        agent.add(`This technology has ${children.length} sub-components: ${list} You can learn more about them by asking about them by name.`);
        // add suggestion chips
        names.forEach(name => agent.add(new Suggestion(name)));
      });
  };

  const getTargetOutcome = () => {
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
    return base('Components').find(componentId)
      .then(component => {
        if (!component) throw new Error(`A component with id: ${componentId} could not be found.`);
        const targetOutcome = component.get('Target Outcome');
        if (!targetOutcome) return agent.add('There is currently no target benefit for this component');
        return agent.add(`${targetOutcome}`);
      });
  };

  const getMeasuredOutcome = () => {
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
    return base('Components').find(componentId)
      .then(component => {
        if (!component) throw new Error(`A component with id: ${componentId} could not be found.`);
        const targetOutcome = component.get('Measured Outcome');
        if (!targetOutcome) return agent.add('There is currently no measured outcome listed for this component');
        return agent.add(`It has achieved ${targetOutcome}`);
      });
  };

  const getSystems = agent => {
    console.log('getSystems()...');
    const placeId = getPlaceId(agent);
    return select('Components')
      .then(components => {
        if (!components || !components.length) {
          agent.add(`I couldn't find any technologies listed for this place.`);
        } else {
            console.log('Found components get systems...');
            const systems = components.filter(component => {
              const places = component.get('Place') || [];
              const hasPlace = places.includes(placeId);
              const isSystem = Boolean(component.get('System'));
              return hasPlace && isSystem;
            })
            .map(component => component.get('Name'));
          if (!systems.length) return agent.add('This place does not have any systems.');
          console.log('systems: ', systems);
          const list = addAndToLastElement([...systems]);
          const message = list.length > 1 ? `This place has several systems: ${systems.join(', ')}` : `This place has a ${systems} system.`;
          console.log('message: ', message);
          agent.add(message);
          systems.forEach(name => agent.add(new Suggestion(name)));
        }
      });
  };

  /* const getSystems = agent => {
    return agent.add('GET SYSTEMS');
  }; */

  const collectsPersonalInfo = (id) => {
    let baseComponent;
    const cId = id || getComponentId(agent);
    return base('Components').find(cId)
      .then(component => {
        if (!component) throw new Error(`Could not find base component with id: ${cId}`);
        baseComponent = component;
        return getChildComponents(component);
      })
      .then(childComponents => {
        const components = Array.isArray(childComponents) ? childComponents : [];
        components.push(baseComponent);
        const dataTypes = components.map(c => c.get('Data Type'));
        var merged = [].concat.apply([], dataTypes).filter(m => m);
        return Promise.all(merged.map(id => base('Data Type').find(id)));
      })
      .then(records => {
        const isPersonal = records.filter(r => r.get('Name') === 'Personal Information');
        if (isPersonal.length) {
          return isPersonal;
        }
        return null;
      });
  };

  const getPlaceComponents = placeId => {
    return select('Components')
      .then(components => {
        return components.filter(r => {
          const places = r.get('Place');
          if (!places || !places.length) return false;
          return r.get('Place').includes(placeId);
        });
      });
  };

  const getDataTypeByName = name => select('Components');

  const placeComponentsCollectsPersonalInfo = placeId => {
    return getPlaceComponents(placeId)
      .then(components => Promise.all(components.map(component => collectsPersonalInfo(component.get('ID')))))
      .then(results => results.some(r => r));
  };

  const getPersonallyIdentifiableComponents = (placeId, componentId) => {
    let dataTypeId;
    const filter = { name: 'Name', value: 'Personal Information' };
    return select('Data Type', filter)
      .then(dataType => dataType[0].get('ID'))
      .then(id => {
        dataTypeId = id;
        return getPlaceComponents(placeId);
      })
      .then(components => components.filter(c => {
        const types = c.get('Data Type') || [];
        return componentId ? c.get('ID') === componentId && types.includes(dataTypeId) : types.includes(dataTypeId);
      }));
  };

  const getPlaceCollectsPersonalData = agent => {
    const originalContext = getPayload(agent);
    if (!originalContext) throw new Error('User requests location but original context was not passed.');
    const placeId = getPlaceId(agent);
    return getPersonallyIdentifiableComponents(placeId) // boston mall
      .then(components => {
        if (!components || !components.length) return agent.add('This place does not collect personal data.');
        const names = components.map(c => c.get('Name'));
        agent.add(`Yes it looks like the following ${names.length === 1 ? 'technology is ' : 'technologies are '} collecting personal data: `);
        agent.add(names.join(', '));
        agent.add(`You can learn more about ${names.length === 1 ? 'it ' : 'them '} by asking me for a specific description.`);
        names.forEach(name => agent.add(new Suggestion(name)));
      });
  };

  const getComponentCollectsPersonalData = agent => {
    const originalContext = getPayload(agent);
    if (!originalContext) throw new Error('User requests location but original context was not passed.');
    const placeId = getPlaceId(agent);
    const componentId = getComponentId(agent);
    return getPersonallyIdentifiableComponents(placeId)
      .then(components => {
        if (!components || !components.length) return agent.add('There do not appear to be any components which collect personal information.');
        const filtered = components.filter(component => component.get('ID') === componentId);
        if (filtered && filtered.length) return agent.add('This component collects personal information.');
        return agent.add('This component does not collect personal information.');
      });
  };

  const getDataTypeNames = component => {
    const componentId = component.get('ID');
    return base('Components').find(componentId)
      .then(component => {
        const info = component.get('Data Type');
        if (!info) {
          throw new Error(`Data Process info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return Promise.all(info.map(id => base('Data Type').find(id)));
      })
      .then(info => info.map(record => record.get('Name')).filter(name => name));
  };

  const storesImageData = component => {
    const PIXEL_BASED_IMAGE = 'Pixel-based Image';
    return getDataTypeNames(component)
      .then(dataTypes => {
        if (!dataTypes || !dataTypes.length) return false;
        return dataTypes.includes(PIXEL_BASED_IMAGE);
      });
  };

  const getCollectsImageData = agent => {
    const originalContext = getPayload(agent);
    if (!originalContext) throw new Error('User requests location but original context was not passed.');
    const componentId = getComponentId(agent);
    if (!componentId) return noComponentFallback(agent);
    return base('Components').find(componentId)
      .then(storesImageData)
      .then(doesStoreImageData => {
        if (doesStoreImageData) return agent.add('It does collect image data.');
        agent.add('It does not collect image data.');
      });
  };

  const getQuestionsToAsk = agent => {
    const originalContext = getPayload(agent);
    if (!originalContext) throw new Error('User requests location but original context was not passed.');
    const componentId = getComponentId(agent);
    if (!componentId) {
      agent.add('You can ask questions to learn about the technologies that are in use here. For example you can ask to be told about a technology specifically or you can ask questions like: ');
      agent.add('Where am I?');
      agent.add('What systems are you using?');
      agent.add('What kind of data is being collected?');
      agent.add('What will you use the information for?');
      agent.add('How long do you keep the data?');
      agent.add('Where is the info stored?');
      agent.add('Do you track personal data?');
      agent.add('Is it taking pictures of me?');
      agent.add('Who can see the data?');
      agent.add('How is my information protected?');
    } else {
      agent.add('You can learn more about this component by asking questions like:');
      agent.add('What kind of data is being collected?');
      agent.add('What will you use the information for?');
      agent.add('How long do you keep the data?');
      agent.add('Where is the info stored?');
      agent.add('Do you track personal data?');
      agent.add('Is it taking pictures of me?');
      agent.add('Who can see the data?');
      agent.add('How is my information protected?');
    }

  };

  const noComponentFallback = agent => {
    agent.add('The way that works varies from system to system. However you can ask about each system individually.');
    return getSystems(agent);
  };

  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }

  /*
   * Map the DF intent to the Handling Method
   */
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('learn about component', learnAboutComponent);
  intentMap.set('learn about place', learnAboutPlace);
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
  intentMap.set('get systems', getSystems);
  intentMap.set('get place collects personal data', getPlaceCollectsPersonalData);
  intentMap.set('get component collects personal data', getComponentCollectsPersonalData);
  intentMap.set('get collects image data', getCollectsImageData);
  intentMap.set('get questions to ask', getQuestionsToAsk);

  // pass intent map to agent
  agent.handleRequest(intentMap);
});

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
