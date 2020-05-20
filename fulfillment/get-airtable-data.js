const util = require('util');
const fs = require('fs').promises;
const Airtable = require('airtable');
const apiKey = process.argv[2];
const baseId = process.argv[3];

if (!apiKey || !baseId) throw new Error('You must pass the Airtable API key as the 1st cmd line argument & the base id as the 2cd arg');

console.log('Initializing..');
console.log(`Set up Airtable API with apiKey: ${apiKey} & baseId: ${baseId}`);

const base = new Airtable({ apiKey }).base(baseId);

const OUTPUT_FILE_PATH = 'dtpr-airtable-data.json';
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

console.log(`Preparing to download tables: ${TABLES.join(', ')}`);

const get = tableName => {
 console.log(`getting (${tableName})...`);
 let arr = [];
 return new Promise((resolve, reject) => {
    base(tableName).select()
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

const execute = async () => {
  try {
    const allArrays = await Promise.all(TABLES.map(name => get(name)));
    const output = {};
    allArrays.forEach((arr, idx) => output[TABLES[idx]] = arr);
    const stringified = JSON.stringify(output).replace("'", "\'");
    const file = await fs.writeFile(OUTPUT_FILE_PATH, stringified);
    console.log(`File created: ${OUTPUT_FILE_PATH}`);
  } catch (reason) {
    console.error(reason);
  };
};

execute();
