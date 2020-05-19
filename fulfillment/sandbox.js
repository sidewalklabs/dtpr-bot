const Airtable = require('airtable');
const base = new Airtable({apiKey: 'keyZsWLtuGKax2Dro'}).base('appe5T5foKvONA32l');

const agent = {
  add: (message) => console.log(message)
};

function Suggestion(message) {
  this.message = message;
};

const componentId = 'rec67VkXfD91hMjP9'; // ir motion sensor
// const componentId = 'rec5d3NEMIf4vXGpW'; // safer city system
// const componentId = 'reciDb69UCJ80rSZw'; // sustainability system
// const componentId = 'rec9mvxQRmvkAC4Do'; // waste management system
// const componentId = 'recT9MVNlQBhjSBSE'; // mirror computer vision camera

const capitalizeString = s => {
  return s && s[0].toUpperCase() + s.slice(1);
}

const titleCase = str => str.replace(/(^[a-z])|(\s+[a-z])/g, txt => txt.toUpperCase());

const learnABoutComponent = () => {
  base('Components').find(componentId)
    .then(component => {
        const { id } = component;
        const placeId = component.get('Place')[0];
        agent.add(`These are the places listed: ${component.get('Place')}`);
        const name = component.get('Name');
        agent.add(`This is a ${name}.`);
        return base('Places').find(placeId);
    })
    .then(place => {
        const name  = place.get('Name');
        agent.add(`It's id is ${place.id}.`);
        agent.add(`It's installed at ${name}.`);
    })
  .catch(reason => {
      console.log('ERROR: ', reason);
    });
};

// learnABoutComponent();

const getTimeRetained = () => {
  console.log('getTimeRetained()...');
  return getStorageData('retention');
};

const getStorage = () => {
  console.log('getStorage()...');
  return getStorageData('storage');
};

const getStorageData = (dataType) => {
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
      const names  = storageInfo.map(storage => {
        console.log(`Storage Type: ${storage.get(dataType)}`)
        console.log(`Storage Name: ${storage.get('Name')}`)
        if (storage.get('PropertyType') === dataType) {
          return storage.get('Description');
        }
      }).filter(name => name);
      agent.add(`The data is ${names.join(',').toLowerCase()}.`);
    })
    .catch(reason => {
        console.log('ERROR: ', reason);
    });
}

const getAccess = () => {
  const dataType = 'Description';
  const infoType = 'Access';
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
      //console.log(storageInfo);
      const names  = info.map(item => item.get(dataType))
        .filter(item => item);
        agent.add(names.join(' '));
    })
    .catch(reason => {
        console.log('ERROR: ', reason);
    });
}

const getAccountability = () => {
  console.log('getAccountability()...');
  const dataType = 'name';
  const infoType = 'Accountability';
  const placeId = 'recAGNOkvYSjMsL0P';
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
      agent.add(`${name} is responsible for it.`);
    })
    .catch(reason => {
        console.log('ERROR: ', reason);
    });
};

const ENTITIES = {
  PLACE_ATTRACTION: 'placeattraction',
  LOCATION: 'location',
  COMPONENT: 'component',
  SYSTEM: 'system',
  PURPOSE: 'Purpose',
  ADDRESS: 'address',
  TECHNOLOGY_TYPE: 'technologytype',
  DATA_PROCESS: 'dataprocess',
  DATA_TYPE: 'datatype'
};

// inpsect parameters to decide which entity type the user is talking about
// organized in terms of prirotiy for simplicties sake (we are not trying to
// handle relationships between entities)
const getPrimaryEntityType = (parameters) => {
  const { placeattraction, location, component, Purpose, address, dataprocess, datatype, technologytype, system } = parameters;
  // order of priorty
  if (placeattraction) return ENTITIES.PLACE_ATTRACTION;
  if (location) return ENTITIES.LOCATION;
  if (component) return ENTITIES.COMPONENT;
  if (system) return ENTITIES.SYSTEM;
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
  switch(type) {
    case ENTITIES.PLACE_ATTRACTION:
      map.base = 'Places',
      map.property = 'Description',
      map.identifier = 'Name',
      map.prepend = ''
      break;
    case ENTITIES.LOCATION:
    case ENTITIES.ADDRESS:
      map.base = 'Places',
      map.property = 'Description',
      map.identifier = 'Name',
      map.prepend = ''
      break;
    case ENTITIES.COMPONENT:
      map.base = 'Components',
      map.property = 'Technology Type',
      map.identifier = 'Name',
      map.prepend = 'It is a',
      map.joinTable = 'Technology Type',
      map.joinProperty = 'Name'
      break;
    case ENTITIES.SYSTEM:
      map.base = 'Components';
      map.property = 'Description';
      map.identifier = 'Name';
      map.prepend = '';
      break;
    case ENTITIES.PURPOSE:
      map.base = 'Purpose',
      map.property = 'Description',
      map.identifier = 'Name',
      map.prepend = 'This means it is'
      break;
    case ENTITIES.DATA_PROCESS:
      map.base = 'Data Process'
      map.property = 'Description',
      map.identifier = 'Name',
      map.prepend = ''
      break;
    case ENTITIES.DATA_TYPE:
      map.base = 'Data Type';
      map.property = 'Description';
      map.identifier = 'Name';
      map.prepend = '';
      break;
    case ENTITIES.TECHNOLOGY_TYPE:
      map.base = 'Technology Type'
      map.property = 'Description',
      map.identifier = 'Name',
      map.prepend = ''
      break;
  }
  return map;
}

const filterFirstPageByFormula = (formula, entityMap) => {
  return new Promise((resolve, reject) => {
    base(entityMap.base)
      .select({ filterByFormula: formula })
      .firstPage((err, records) => {
      if (err) return reject(err);
      return resolve(records);
    });
  });
};

const getChildComponents = component => {
  if (!component || typeof component.get !== 'function') return Promise.resolve([]);
  const children = component.get('Child components');
  if (!children || !children.length) return Promise.resolve([]);
  return Promise.all(children.map(id => base('Components').find(id)));
};

const whatIs = () => {
  console.log('whatIs()...');
  // access this map at agent.parameters
  const parametersMock = {
    // placeattraction: '307',
    // component: 'Temperature Sensor',
    // component: 'Infrared Depth Sensors',
    // component: 'Numina Sensor',
    component: 'Security Camera',
    // Purpose: 'Enforcement',
    // Purpose: 'Safety & Security',
    // address: 'City Intersection (Queens Quay & Small St)',
    // location: 'Union Station',
    // dataprocess: 'K-Anonymity',
    // technologytype: 'microphone',
    // datatype: 'Spatial',
    // system: 'Sustainability System'
    // system: 'HVAC System'
    // system: 'Lighting System'
    // system: 'Waste Management System'
  };
  const primaryEntity = getPrimaryEntityType(parametersMock);
  const entityMap = mapEntityToInfo(primaryEntity);
  console.log(`Q: What is ${parametersMock[primaryEntity]}? (${primaryEntity})`);
  const query = `{${entityMap.identifier}} = "${capitalizeString(parametersMock[primaryEntity])}"`;
  console.log('entityMap: ', entityMap);
  console.log('query: ', query);
  filterFirstPageByFormula(query, entityMap)
    .then(records => {
      if (!records.length) {
        agent.add('I am not able to provide an answer to that question currently. I will take a note and look for the future.');
        throw new Error(`What Is intent with parameters ${parametersMock} could not resolve any information.`);
      }
      // record will be an id in the event of a join
      const record = records[0];
      // handle joins if any
      if (entityMap.joinTable) return base(entityMap.joinTable).find(record.get(entityMap.property)[0]);
      // otherwise pass record through
      return record;
    })
    .then(record => {
      let append = '';
      const answer = entityMap.joinTable ? record.get(entityMap.joinProperty) : record.get(entityMap.property);
      const message = `${entityMap.prepend} ${answer}.`;
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
    list[list.length-1] = `and ${list[list.length-1]}`;
  }
  return list;
};

const getDataProcessList = () => {
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
      const list = addAndToLastElement([...names]);
      agent.add(`The data is handled using ${list.join(', ')} data processes.`);
      // add suggestion chips
      names.forEach(name => agent.add(new Suggestion(`What does ${name} mean?`)))
    })
    .catch(reason => {
        console.log('ERROR: ', reason);
    });
}

const getDataTypesList = () => {
  return base('Components').find(componentId)
    .then(component => {
        const info = component.get('Data Type');
        if (!info) {
          agent.add(`This component doesn't appear to have Data Process information to share.`);
          throw new Error(`Data Process info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return Promise.all(info.map(id => base('Data Process').find(id)));
    })
    .then(info => {
      const names = info.map(dataProcess => dataProcess.get('Name')).filter(name => name);
      const list = addAndToLastElement([...names]);
      agent.add(`The data collected is stored as ${list.join(', ')}.`);
      // add suggestion chips
      names.forEach(name => agent.add(new Suggestion(`What does ${name} mean?`)))
    })
    .catch(reason => {
        console.log('ERROR: ', reason);
    });
}

const whereAmI = () => {
  console.log('whereAmI()...');
  const placeId = 'recAGNOkvYSjMsL0P';
  return base('Places').find(placeId)
    .then(place => {
      if (!place) throw new Error(`where am I intent was passed placeId: ${placeId} but no place data could be loaded.`);
      agent.add(place.get('Headline'));
    });
};

const getTheParts = () => {
  // does it have child components? return a list of those
  return base('Components').find(componentId)
    .then(getChildComponents)
    .then(children => {
      if (!children || !children.length) return agent.add('It is a simple technology it does not have any child components or systems to describe.');
      const names = children.map(child => child.get('Name')).filter(name => name);
      agent.add(`This technology has ${children.length} sub-components. You can learn more about them.`);
      // add suggestion chips
      names.forEach(name => agent.add(new Suggestion(name)))
    })
    .catch(console.error);
};

const getTargetOutcome = () => {
  return base('Components').find(componentId)
    .then(component => {
      if (!component) throw new Error(`A component with id: ${componentId} could not be found.`);
      const targetOutcome = component.get('Target Outcome');
      if (!targetOutcome) return agent.add('There is currently no target benefit for this component');
      return agent.add(targetOutcome);
    })
    .catch(console.error);
};

const getSystems = () => {
  const placeId = 'recHJJkuqk0AYjHa9';
  const entityMap = { base: 'Components' };
  return filterFirstPageByFormula('', entityMap)
    .then(components => {
      if (!components || !components.length) {
        agent.add(`I couldn't find any technologies listed for this place.`);
      } else {
        const systems = components.filter(component => {
          const places = component.get('Place') || [];
          const hasPlace = places.includes(placeId);
          const isSystem = Boolean(component.get('System'));
          return hasPlace && isSystem;
        })
          .map(component => component.get('Name'));
          const list = addAndToLastElement([...systems]);
          const message = list.length > 1 ? `This place has several systems: ${systems.join(', ')}` : `This place has a ${systems} system.`
          agent.add(message);
          systems.forEach(name => agent.add(new Suggestion(name)));
      }
    })
    .catch(console.error);
};

const collectsPersonalInfo = (id) => {
  let baseComponent;
  const cId = id || componentId;
  return base('Components').find(cId)
    .then(component => {
      if (!component) throw new Error(`Could not find base component with id: ${componentId}`);
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
    })
    .catch(console.error);
};

const getPlaceComponents = placeId => {
  return new Promise((resolve, reject) => {
    let components = [];
    base('Components').select()
      .eachPage((records, fetchNextPage) => {
        const filtered = records.filter(r => {
          const places = r.get('Place');
          if (!places || !places.length) return false;
          return r.get('Place').includes(placeId);
        });
        components = [...filtered];
        fetchNextPage();
      }, err => {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }
        resolve(components);
      });
  });
};

const getDataTypeByName = name => {
  return new Promise((resolve, reject) => {
    base('Components').select()
      .eachPage((records, fetchNextPage) => {
        components = [...records];
        fetchNextPage();
      }, err => {
        if (err) {
          console.error(err);
          reject(err);
          return;
        }
        resolve(components);
      });
  })
};

const placeComponentsCollectsPersonalInfo = placeId => {
  return getPlaceComponents(placeId)
    .then(components => Promise.all(components.map(component => collectsPersonalInfo(component.get('ID')))))
    .then(results => results.some(r => r));
}

// if componentId is passed we are only looking for a true / false
// on whether the specific component tracks personal data
const getPersonallyIdentifiableComponents = (placeId, componentId) => {
  let dataTypeId;
  const formula = '{Name} = "Personal Information"';
  return filterFirstPageByFormula(formula, { base: 'Data Type'})
    .then(dataType => dataType[0].get('ID'))
    .then(id => {
      dataTypeId = id;
      return getPlaceComponents(placeId)
    })
    .then(components => components.filter(c => {
      const types = c.get('Data Type') || [];
      return componentId ? c.get('ID') === componentId && types.includes(dataTypeId) : types.includes(dataTypeId);
    }));
}

const getDataTypes = component => {
  const componentId = component.get('ID');
  return base('Components').find(componentId)
    .then(component => {
        const info = component.get('Data Type');
        if (!info) {
          throw new Error(`Data Process info was requested for a component: ${componentId} that does not have any defined.`);
        }
        return Promise.all(info.map(id => base('Data Process').find(id)));
    })
    .then(info => info.map(dataProcess => dataProcess.get('Name')).filter(name => name));
}

const storesImageData = component => {
  const PIXEL_BASED_IMAGE = 'Pixel-based Image';
  return getDataTypes(component)
    .then(dataTypes => {
      if (!dataTypes || !dataTypes.length) return false;
      return dataTypes.includes(PIXEL_BASED_IMAGE);
    });
};

const getCollectsImageData = (id) => {
  let baseComponent;
  const cId = id || componentId;
  return base('Components').find(cId)
    .then(storesImageData)
    .then(doesStoreImageData => {
      if (doesStoreImageData) return agent.add('It does collect image data.');
      agent.add('It does not collect image data.');
    })
};

// getTimeRetained();
// getStorage();
// getAccess();
// getAccountability();
// whatIs();
// console.log(titleCase('Security camera RFID Red blue green.'));
// getDataProcessList();
// getDataTypesList();
// whereAmI();
// getTheParts();
// getTargetOutcome();
// getSystems();
// collectsPersonalInfo();
// collectsPersonalInfo('rec5d3NEMIf4vXGpW');
getPlaceComponents('recAGNOkvYSjMsL0P')
  .then(results => console.log(results.length));
// placeComponentsCollectsPersonalInfo('recAGNOkvYSjMsL0P')
//   .then(console.log);
// getPersonallyIdentifiableComponents('recHJJkuqk0AYjHa9') // boston mall expects yes
//   .then(components => console.log(components.map(c => c.get('Name'))));
// getPersonallyIdentifiableComponents('recHJJkuqk0AYjHa9', 'rec8e5i3QIUQ3uNXj') // boston mall & light level sensor expect no
//   .then(components => console.log(components.map(c => c.get('Name'))));
// getPersonallyIdentifiableComponents('recHJJkuqk0AYjHa9', 'recT9MVNlQBhjSBSE') // boston mall & magic mirror
//   .then(components => console.log(components.map(c => c.get('Name'))));
// getCollectsImageData();
