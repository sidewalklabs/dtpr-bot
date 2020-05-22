# Digital Transparency in the Public Realm Chat Bot

[Digital Transparency in the Public Realm](https://sidewalklabs.com/dtpr/) is a project that seeks to facilitate the co-creation of prototypes that can advance digital transparency and enable agency in the world's public spaces.

With cities increasingly embracing digital technology in the built environment, we believe people should be able to quickly understand how these technologies work and the purposes they serve. The DTPR is first & foremost a communication standard. It provides a way to think about technology and data in shared spaces. As a communication standard it can be implemented in a variety of mediums. Agentive technologies with verbal interfaces are becoming increasingly relevant to our interaction with our environment and seem likely to continue that trajectory into the future. The DTPR-Bot is an exploration of how the DTPR taxonomy could provide the underlying categorical structure to a conversation that people could have with the spaces they live in.

This repository includes all the resources necessary to stand up a DTPR Chatbot on Google's Dialog-Flow service and examples of how to integrate a chat interface. So using this repository in combination with Dialog-Flow it should be possible to run your own experiments or contribute to the project.

You can try out the DTPR Bot [here](https://normative.github.io/dtpr-bot/index.html)

## The Components of the Chat Bot

### DTPR Taxonomy
The chat bot uses the data and the set of defintions in the DTPR Taxonomy to be able to understand and attempt to respond to the questions it is asked about places. The DTPR taxonomy is a full set of definitions of the key concpets and entities that structure our understanding of how data and technology are functioning in a space.  The initial draft of the taxonomy and the associated icons are managed in an Airtable, which you can see [here](https://airtable.com/shrsW7o7ji3VjsZSz). It is this Airtable that provides both the content and category structure used to respond to a user's questions to the system.

### Dialog-Flow
[Dialogflow](https://dialogflow.com/) is a service that runs on Google's Cloud Platform that uses machine learning to recognize intents from human conversational inputs and maps them to responses. It also provides a way to inject custom fulfillment logic into this process. Dialog-Flow has a set of table stakes sematic entities that it can recognize however it is also possible to extend these categories. The categories from the DTPR Taxonomy have been added to the DTRP Chat Bot Dialog-Flow project. A Dialog-Flow project also contains a list of intents. Intents are meant to represent the 'intent' of a person interacting with the bot. What is it that they want? What are the varied ways that this intent might be expressed? This custom mapping of the intents that people might have while inspecting the technology in shared space to the ways that they would go about asking for this information is also a part of the Dialog-Flow project. This is managed partially by the list of intents which are managed within the Dialog-Flow service in combination with the Node functions in the custom fulfillment code.

To learn more about how Dialog-Flow handles requests, entities and conversational context you can read the [documentation](https://dialogflow.com/docs).

### Fulfillment Code
The custom fulfillment code is a series of Node functions which are executed as handlers when intents are triggered. To function correctly the Node in the source directory must be copied into your Dialog-Flow agent's fulfillment section or deployed on an external server using Dialog-Flow's webhook implementation.

## Getting Started

- Download the repo by cloning it.
```
git clone https://github.com/normative/dtpr-bot.git
```
- Compress the repo to a Zip file. This is the package that will be uploaded to Dialog-Flow.
- Create a Dialog-Flow account
- Create an Agent
- In the settings for the Agent which can be accessed via the Gear icon next to the name in the list you will find the Import/Export tab.
- Import the above Zip file.
- Under general settings ensure the checkbox for the 'V2 API' is selected.
- Your agent id will be required as parameter to pass into the front end chat client. An easy way to get it is to go the 'integrations' section. Toggle on the Dialog-Flow Messenger Beta. Then click on the button to get sample code for your integrations that will look something like this. Copy the agent-id.

```
<script src="https://www.gstatic.com/dialogflow-console/fast/messenger/bootstrap.js?v=1"></script>
<df-messenger
  intent="WELCOME"
  chat-title="swl-dtpr-places-bot"
  agent-id="aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaaa"
  language-code="en"
></df-messenger>
```

- To create the chat bot client check out the pages under the integration examples for sample implementations. Note that the user-id parameter is passed into the Dialog-Flow backend as a string. This string has been used to inject JSON formatted data into the chat client request. It is this data that is used to provide the agent with the starting context for the conversation in terms of the intent, place, & component that the user is interested in.

```
const chatConfig = {
      agentId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaaa', // this is the dialog-flow id for the specific agent which should handle the requests
      startingIntent: 'learn-about-component', // the intent that the conversation will start on - also persisted under the originalIntent
      placeId: 'recHJJkuqk0AYjHa9', // the place that the system or component is in - id corresponds to DTPR Airtable place id
      componentId: 'recT9MVNlQBhjSBSE' // Airtable 'components' id of the mirror computer vision system
    };
```

- This data can be accessed by the fulfillment code using the getPayload() method.
- Finally copy and paste the code from fulfillment/index.js into the code window in the Fulfillment section of the Dialg-Flow agent. This is also how you will update the fulfillment logic if you make changes to it.
- A file fulfillment/sandbox.js has been provided to serve as a place to test and develop fulfillment code. If you make use of it you must install the dependencies.

```
// beginning from the project directory
cd fulfillment
npm install

// to run the sandbox code
node sandbox.js
```

## Contributors

The development of these design patterns and prototypes would not have been possible without the large number of contributors who invested their expertise and time in this project. They are listed [here](contributors.md).

## License

The _Icons_, _Design Guide_ and _Taxonomy_ for DTPR are licensed by the Digital Transparency in the Public Realm contributors under the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
Portions of the _DTPR Icons_ incorporate elements of, or are derived from, the [Material icons](https://material.io/tools/icons/). The Material icons are available under the [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html).
The source code for the _Digital Channel Prototype_ is licensed under [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0.html).
Sidewalk Labs trademarks and other brand features within these works are not included in this license.

## How to Contribute

[Sidewalk Labs](https://www.sidewalklabs.com/) runs this project. You can contribute by logging requests for functionality or issues with the implementation. We’re looking for partners who want to advance the use and adoption of these standards in the public realm. Please get in touch at dtpr-hello@sidewalklabs.com if you would be interested to add contribute to the code base.
