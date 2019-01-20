import { ErrorCallback, waterfall, whilst } from 'async';
import { AWSError, S3 } from 'aws-sdk';
import {
  ListObjectVersionsOutput,
  ObjectIdentifierList,
  ObjectVersionList
} from 'aws-sdk/clients/s3';

function toObjectIdentifierList(
  objectList: ObjectVersionList
): ObjectIdentifierList {
  return objectList.reduce((
    identifiers: ObjectIdentifierList,
    { Key, VersionId }
  ) => {
    if (Key) {
      identifiers.push({ Key, VersionId });
    }

    return identifiers;
  }, []);
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
  let moreVersionsToFetch = true;

  whilst(
    () => moreVersionsToFetch,
    next => {
      waterfall(
        [
          /**
           * Get up to 1000 versions and delete markers
           */
          (cb: (err: AWSError, data?: ListObjectVersionsOutput) => void) => {
            client.listObjectVersions({ Bucket: bucketName }, cb);
          },
          /**
           * Delete all versions and delete markers in the list output
           */
          (data: ListObjectVersionsOutput, cb: (err?: AWSError) => void) => {
            moreVersionsToFetch = !!data.IsTruncated;

            const identifiers = [
              ...(data.Versions ? toObjectIdentifierList(data.Versions) : []),
              ...(data.DeleteMarkers
                ? toObjectIdentifierList(data.DeleteMarkers)
                : [])
            ];

            if (!identifiers.length) {
              cb();

              return;
            }

            client.deleteObjects(
              {
                Bucket: bucketName,
                Delete: { Objects: identifiers }
              },
              cb
            );
          }
        ],
        next
      );
    },
    callback
  );
}
