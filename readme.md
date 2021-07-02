# Create media job

[![codecov](https://codecov.io/gh/SoTrx/function-create-media-job/branch/master/graph/badge.svg?token=I6ZVGPI3BJ)](https://codecov.io/gh/SoTrx/function-create-media-job)
[![Deploy to Azure](https://img.shields.io/badge/Deploy%20To-Azure-blue?logo=microsoft-azure)](https://portal.azure.com/?WT.mc_id=dotnet-0000-frbouche#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2FSoTrx%2Ffunction-create-media-job%2Fmaster%2Fdeploy.json)

This Azure function triggers an encoding task each time a file is added to a specific storage container.

## Installation

The **deploy to Azure button** above will deploy a Node 14 linux functionApp with its associated storage container and application insight. The code will be deployed from GH directly.

**Important:** Event when deploying using this method, you will have to fill the values **AAD_CLIENT_ID**, **AAD_SECRET** and **AAD_TENANT_DOMAIN** (see [configuration](#configuration) section), as it's not possible to create an AAD Service Principal using ARM templates.

You can also choose to deploy the function manually. To do that, you must first create an [Azure Function App](https://docs.microsoft.com/en-us/azure/azure-functions/functions-get-started?pivots=programming-language-csharp). You can either :

- Use a **Node 14** runtime and deploy the code using [the Az CLI](https://docs.microsoft.com/fr-fr/cli/azure/functionapp?view=azure-cli-latest#az_functionapp_deploy) , the VS Code extension (CTRL + SHIFT + P -> Deploy to Function App), or creating a new _Application Setting_ (in the _Configuration_ panel) with name `WEBSITE_RUN_FROM_PACKAGE` and value `https://github.com/SoTrx/function-upload-to-blob/releases/latest/download/default.function-upload-to-blob.zip`.
- Use a **Docker** runtime and then put _dockerutils/function-create-media-job_ in _Container Settings_ once the Function App is created.

Using one of theses methods, you'll have to set every variables listed in the [configuration](#configuration)section.

## Usage

After going through the [configuration](#configuration) step, drop a file in the chosen container. This will start the encoding process and drop the result into a brand new container (`vid-[uuid]`) in the same storage account.

Be aware that there can only be **one asset per container** (see [workflow](#azure-media-services-workflow)) while working with media services. Thus, an output container cannot be used twice, hence the uuid in the output container name.

### Limitation and workaround

The same "one asset per container" policy also applies to input assets. This means that trying to execute two parallels instances of this function will fail. The first will run ok, the second will fail because there can't be two assets in the input container.

The workaround used to bypass this limitation is to move the incoming file to a new storage container before turning it to an asset. However, this means that we must be able to move around files in the storage container. This is not something Azure Media Services is capable from the get go, so another library ([@azure/storage-blob](https://www.npmjs.com/package/@azure/storage-blob)) is used for this purpose. This is why an additional storage-account wise connection string must be provided.

### Azure Media Services workflow

![Media services workflow](https://docs.microsoft.com/en-us/azure/media-services/latest/media/encoding/transforms-jobs.png)

The part of Azure Media Services that is used by this function is fairly simple.

Media Services mainly works with assets. An encoding process can be represented like this :

```
                                         api                 transform
                            SRC_FILE -----------> SRC_ASSET -----------> DST_ASSET
```

An input file must be turned into an asset before being processed.

A transform is a set of encoding parameters (in a FFMPEG kind of way) Applying a transform on an asset generates a new modified asset.

For more details, here's the [documentation](https://docs.microsoft.com/en-us/azure/media-services/latest/transform-jobs-concept)

## Configuration

This function uses multiple **mandatory** variables.

First are the variables needed to access the Azure Media Services API. You can find all these in the Azure portal. In the media services resource, select "API access" :

- **AAD_CLIENT_ID** : -
- **AAD_SECRET** : -
- **AAD_TENANT_DOMAIN** : -
- **SUBSCRIPTION_ID** : -
- **RESOURCE_GROUP** : -
- **MEDIA_SERVICES_NAME** : Listed as ACCOUNT_NAME on the API access page, renamed to prevent confusion with the storage account. 

Next are the variables added by the function itself :

- **INPUT_CONTAINER** : The storage account container to watch for new incoming files. Adding a new file to this container will launch a new encoding process.
- **OUTPUT_CONTAINER_PREFIX** : Prefix for the name of output container to use. The created output container will be named `[OUTPUT_CONTAINER_PREFIX]-[vid]`
- **TRANSFORM_NAME** : The encoding preset name to use to encode the files. If there isn't any preset associated with **TRANSFORM_NAME**, it will be created using the __AdaptiveStreaming__ default preset.
- **NODE_ENV** : Set it to **production**. Any other value would result in the function using a mock instead of Azure Media Services.
- **ACCOUNT_CONNECTION_STRING** : READ/WRITE/DELETE Access to the whole storage account. You can generate one in the "Shared access signature" section of the Storage account page in the portal. This is needed for the workaround explained [here](#limitation-and-workaround). This string must begin with `BlobEndpoint=`

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

- \*.test.ts files are for unit testing, included in the coverage
- \*.e2e.test.ts files are using production resources. Thus, running them may have a (significant) cost. This is why, these are skipped by default and excluded from the coverage report. You will also need your own _localsettings.json_.
