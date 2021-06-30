# Create media job

[![codecov](https://codecov.io/gh/SoTrx/function-create-media-job/branch/master/graph/badge.svg?token=I6ZVGPI3BJ)](https://codecov.io/gh/SoTrx/function-create-media-job)

This Azure function triggers an encoding task each time a file is added to a specific storage container.

## Installation

(WIP) ~~The **deploy to Azure button** above will deploy a Node 14 linux functionApp with its associated storage container and application insight. The code will be deployed from GH directly. All the necessary environment variables are set, this should work out of the box.~~

You can also choose to deploy the function manually. To do that, you must first create an [Azure Function App](https://docs.microsoft.com/en-us/azure/azure-functions/functions-get-started?pivots=programming-language-csharp). You can either :

- Use a **Node 14** runtime and deploy the code using [the Az CLI](https://docs.microsoft.com/fr-fr/cli/azure/functionapp?view=azure-cli-latest#az_functionapp_deploy) , the VS Code extension (CTRL + SHIFT + P -> Deploy to Function App), or creating a new _Application Setting_ (in the _Configuration_ panel) with name `WEBSITE_RUN_FROM_PACKAGE` and value `https://github.com/SoTrx/function-upload-to-blob/releases/latest/download/default.function-upload-to-blob.zip`.
- Use a **Docker** runtime and then put _dockerutils/function-create-media-job_ in _Container Settings_ once the Function App is created.

## Usage

After going through the [configuration](#configuration) step, drop a file in the chosen container. This will start the encoding process and drop the result into a brand new container (`vid-[uuid]`) in the same storage account. 

Be aware that there can only be **one asset per container** (see [workflow](#azure-media-services-workflow)) while working with media services. Thus, an output container cannot be used twice, hence the uuid in the output container name.

### Limitation
The same "one asset per container" policy also applies to input assets. This means that trying to execute two parallels instances of this function will fail. The first will run ok, the second will fail because there can't be two assets in an input container.

This limitation should be lifted by moving the input file to another container before turning it to an asset. I'll do just this some time later.

### Azure Media Services workflow

![Media services workflow](https://docs.microsoft.com/en-us/azure/media-services/latest/media/encoding/transforms-jobs.png)

The part of Azure Media Services that is used by this function is fairly simple.

Media Services can only use **assets**.

/!\WIP/!\

For more details, here's the [documentation](https://docs.microsoft.com/en-us/azure/media-services/latest/transform-jobs-concept)

## Configuration

This function uses multiple **mandatory** variables.

First are the variables needed to access the Azure Media Services API. You can find all these in the Azure portal. In the media services resource, select "API access" :

- **AAD_CLIENT_ID** : -
- **AAD_SECRET** : -
- **AAD_TENANT_DOMAIN** : -
- **SUBSCRIPTION_ID** : -
- **RESOURCE_GROUP** : -
- **ACCOUNT_NAME** : -

Next are the variables added by the function itself :

- **INPUT_CONTAINER** : The storage account container to watch for new incoming files. Adding a new file to this container will launch a new encoding process.
- **TRANSFORM_NAME** : The encoding preset name to use to encode the files. If there isn't any preset associated with **TRANSFORM_NAME**, it will be created using the *CONTENTAWAREENCODING* default preset.
- **NODE_ENV** : Set it to **production**. Any other value would result in the function using a mock instead of Azure Media Services.

See [application settings documentation](https://docs.microsoft.com/en-us/azure/azure-functions/functions-how-to-use-azure-function-app-settings#settings) for more details.

```json
{
  "bindings": [
    {
      "name": "myBlob",
      "type": "blobTrigger",
      "direction": "in",
      "path": "%InputContainer%/{name}",
      "connection": "videossharingscontainer_STORAGE"
    }
  ],
  "scriptFile": "../dist/encode-video/index.js"
}
```

## Running tests

Two types of tests are included :

- *.test.ts files are for unit testing, included in the coverage
- *.e2e.test.ts files are using production resources. Thus, running them may have a (significant) cost. This is why, these are skipped by default and excluded from the coverage report. You will also need your own _localsettings.json_.
