import {
  AzureLoginProvider,
  AzureBlobClientFactory,
  IAzLoginCredentials,
  IContainerOptions,
  ILoginCredentials,
  IMediaClient,
  IStorageAccountOptions,
} from "../../@types/media-client";
import { AzureMediaServices } from "@azure/arm-mediaservices";
import {
  AssetsCreateOrUpdateResponse,
  BuiltInStandardEncoderPreset,
  JobInputUnion,
  JobOutputAsset,
  TransformsCreateOrUpdateResponse,
} from "@azure/arm-mediaservices/esm/models";
import { v4 as uuidv4 } from "uuid";
import { inject, injectable } from "inversify";
import TYPES from "../../types";

interface Job {
  input: JobInputUnion;
  outputs: JobOutputAsset[];
  encodingPreset: TransformsCreateOrUpdateResponse;
}

@injectable()
export class AzureMediaClient implements IMediaClient {
  private azMediaClient: AzureMediaServices;
  private azBlobClient;
  private options: IAzLoginCredentials;
  private job: Job = {
    input: undefined,
    outputs: undefined,
    encodingPreset: undefined,
  };
  private static readonly DEFAULT_ENCODING_PRESET: BuiltInStandardEncoderPreset =
    {
      odatatype: "#Microsoft.Media.BuiltInStandardEncoderPreset",
      presetName: "ContentAwareEncoding",
    };

  constructor(
    @inject(TYPES.AzureMediaServices)
    private AzureMediaServices: (...args) => AzureMediaServices,
    @inject(TYPES.AzureLoginProvider)
    private azureLoginProvider: AzureLoginProvider,
    @inject(TYPES.AzureBlobServices)
    private azBlobProvider: AzureBlobClientFactory
  ) {}

  /**
   * Create a media service client.
   * /!\ Must be called before any other method /!\
   * @param options
   */
  async login<T extends ILoginCredentials>(options: T): Promise<IMediaClient> {
    this.options = options as unknown as IAzLoginCredentials;
    const credentials = await this.azureLoginProvider(
      this.options.clientId,
      this.options.secret,
      this.options.tenant
    );
    this.azMediaClient = this.AzureMediaServices(
      credentials,
      this.options.subId
    );
    return this;
  }

  /**
   * Select a file in an Azure Storage container, copy it to a temp container,
   * create an asset from it and set it as an input for the current job
   * @param name name of the file in the storage container
   * @param container container info
   */
  async setInput(
    name: string,
    container: IContainerOptions
  ): Promise<IMediaClient> {
    if (!this.azMediaClient) throw new Error("Not logged in !");
    // Azure Media Services only supports ONE asset per container
    // An asset must be alive through the whole encoding process
    // If we didn't copy the file to another temp container,
    // executing two jobs in parallel will fail
    const tmpContainerName = await this.moveToTempContainer(name, container);
    const inputAsset = await this.createAsset(
      name,
      Object.assign(container, { container: tmpContainerName })
    );
    this.job.input = {
      odatatype: "#Microsoft.Media.JobInputAsset",
      assetName: inputAsset.name,
    };
    return this;
  }

  /**
   * Select a file in an Azure Storage container, create an asset from it
   * and set it as an output for the current job
   * @param name name of the file in the storage container
   * @param container container info
   */
  async setOutput(
    name: string,
    container: IContainerOptions
  ): Promise<IMediaClient> {
    if (!this.azMediaClient) throw new Error("Not logged in !");
    const outputAsset = await this.createAsset(name, container);
    this.job.outputs = [
      {
        odatatype: "#Microsoft.Media.JobOutputAsset",
        assetName: outputAsset.name,
      },
    ];
    return this;
  }

  /**
   * Set the encoding preset to use for the job. If not presetDefinition is provided, the adaptive streaming default is used.
   * @param name name of the preset. This unique name ill allow to retrieve the preset from media services
   * @param storageAccount storage account options
   * @param presetDefinition Definition of a preset. Although generic, this should be an BuiltInStandardEncoderPreset.
   *
   */
  async setEncodingPreset<T>(
    name: string,
    storageAccount: IStorageAccountOptions,
    presetDefinition?: T
  ): Promise<IMediaClient> {
    if (!this.azMediaClient) throw new Error("Not logged in !");

    // Attempt to fetch existing preset by name
    this.job.encodingPreset = await this.azMediaClient.transforms.get(
      storageAccount.resourceGroup,
      storageAccount.storageAccount,
      name
    );
    // And if it doesn't exists yet, create it
    if (!this.job.encodingPreset?.id)
      this.job.encodingPreset = await this.createNewEncodingPreset(
        name,
        storageAccount,
        presetDefinition as unknown as BuiltInStandardEncoderPreset
      );
    return this;
  }

  /**
   * Send the job to Azure Media Services, starting the encoding process.
   * @param jobName name of the job to use. Must be unique
   * @param storageAccount storage account options
   */
  async submitJob(
    jobName: string,
    storageAccount: IStorageAccountOptions
  ): Promise<IMediaClient> {
    const missingProps = Object.keys(this.job).filter(
      (key) => this.job[key] === undefined
    );
    if (missingProps.length > 0)
      throw new Error(
        `These properties must be defined before submitting the job : ${missingProps.join(
          ", "
        )} !`
      );
    await this.azMediaClient.jobs.create(
      storageAccount.resourceGroup,
      storageAccount.storageAccount,
      this.job.encodingPreset.name,
      jobName,
      {
        input: this.job.input,
        outputs: this.job.outputs,
      }
    );
    return this;
  }

  /**
   * Creates a new "Transform", an encoding preset, declared once and usable multiple times
   * @param name name of the transform to create
   * @param storageAccount storage account options
   * @param presetDefinition Either a Microsoft provided preset or a custom one
   * @see  https://docs.microsoft.com/fr-fr/rest/api/media/transforms/list
   * @returns created transform
   */
  private async createNewEncodingPreset(
    name: string,
    storageAccount: IStorageAccountOptions,
    presetDefinition = AzureMediaClient.DEFAULT_ENCODING_PRESET
  ): Promise<TransformsCreateOrUpdateResponse> {
    const preset = await this.azMediaClient.transforms.createOrUpdate(
      storageAccount.resourceGroup,
      storageAccount.storageAccount,
      name,
      {
        name: name,
        outputs: [
          {
            preset: presetDefinition,
          },
        ],
      }
    );
    if (!preset.id)
      throw new Error(
        `Could not create encoding preset with name ${name} and container ${JSON.stringify(
          storageAccount
        )}`
      );
    return preset;
  }

  /**
   * Creates an Azure Media Service asset from a file in a storage container.
   * All files processed by Az media services, including inputs,
   * must be first converted into assets.
   * @param name name of the file in the storage container
   * @param container container info
   * @returns
   */
  private async createAsset(
    name: string,
    container: IContainerOptions
  ): Promise<AssetsCreateOrUpdateResponse> {
    const asset = await this.azMediaClient.assets.createOrUpdate(
      container.resourceGroup,
      container.storageAccount,
      name,
      {
        container: container.container,
      }
    );
    if (!asset.name)
      throw new Error(
        `Could not create asset ${name} in container ${JSON.stringify(
          container
        )}`
      );
    return asset;
  }

  /**
   * Copy a blob to a new temporary container
   * @param blobName blob name to copy
   * @param container container infos
   * @returns name of the temp container
   */
  public async moveToTempContainer(
    blobName: string,
    container: IContainerOptions
  ): Promise<string> {
    const tempContainer = `tmp-${uuidv4()}`;
    const blobServClient = this.azBlobProvider(container.sasUrl);
    const srcCtnClient = blobServClient.getContainerClient(container.container);
    const cpyCtnClient = blobServClient.getContainerClient(tempContainer);
    await cpyCtnClient.create();
    const srcBlobClient = srcCtnClient.getBlobClient(blobName);
    const destBlobClient = cpyCtnClient.getBlobClient(blobName);
    const copyThread = await destBlobClient.beginCopyFromURL(srcBlobClient.url);
    await copyThread.pollUntilDone();
    await srcBlobClient.deleteIfExists();
    return tempContainer;
  }
}
