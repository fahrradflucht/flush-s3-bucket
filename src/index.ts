import { AWSError, S3 } from 'aws-sdk';
import { ObjectIdentifierList, ObjectVersionList } from 'aws-sdk/clients/s3';

export type ErrorCallback<E = Error> = (err?: E | null) => void;

function toObjectIdentifierList(
  objectList: ObjectVersionList
): ObjectIdentifierList {
  return objectList.reduce(
    (identifiers: ObjectIdentifierList, { Key, VersionId }) => {
      if (Key) {
        identifiers.push({ Key, VersionId });
      }

      return identifiers;
    },
    []
  );
}

async function flushS3BucketPromise(
  client: S3,
  bucketName: string
): Promise<void> {
  let moreVersionsToFetch = true;

  while (moreVersionsToFetch) {
    // Get up to 1000 versions and delete markers

    const data = await client
      .listObjectVersions({ Bucket: bucketName })
      .promise();

    // Delete all versions and delete markers in the list output

    moreVersionsToFetch = !!data.IsTruncated;

    const identifiers = [
      ...(data.Versions ? toObjectIdentifierList(data.Versions) : []),
      ...(data.DeleteMarkers ? toObjectIdentifierList(data.DeleteMarkers) : [])
    ];

    if (!identifiers.length) {
      return;
    }

    await client
      .deleteObjects({
        Bucket: bucketName,
        Delete: { Objects: identifiers }
      })
      .promise();
  }
}

/**
 * Removes all objects (including all object versions and Delete Markers) in
 * the specififed S3 bucket. This ensures that the bucket is deletable.
 *
 * @param client S3 service interface object
 * @param bucketName Target bucket identifier
 * @param callback Callback called when the operation is completed or when the
 * first error occured.
 */
export function flushS3Bucket(
  client: S3,
  bucketName: string,
  callback: ErrorCallback<Error | AWSError>
): void {
  flushS3BucketPromise(client, bucketName)
    .then(() => callback())
    .catch(callback);
}
