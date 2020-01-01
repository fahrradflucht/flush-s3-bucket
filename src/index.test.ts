import { S3 } from 'aws-sdk';
import { randomBytes } from 'crypto';
import { flushS3Bucket } from '.';

const clientConfiguration = {
  endpoint: process.env.S3_ENDPOINT || 'http://localhost:8000',
  s3ForcePathStyle: true
};

const createBucketName = (extension: string) =>
  `awesome-test-bucket-${extension}`;

const timesLimit = async (
  count: number,
  limit: number,
  iteratee: (n: number) => Promise<unknown>
): Promise<void> => {
  let n = 0;

  const startWorker = async () => {
    while (n < count) {
      n += 1;
      await iteratee(n);
    }
  };

  await Promise.all([...Array(limit)].map(() => startWorker()));
};

describe('flushS3Bucket', () => {
  let s3: S3;
  let bucketName: string;

  beforeAll(() => {
    s3 = new S3(clientConfiguration);
  });

  beforeEach(done => {
    bucketName = createBucketName(randomBytes(8).toString('hex'));
    s3.createBucket({ Bucket: bucketName }, done);
  });

  afterEach(done => {
    s3.deleteBucket({ Bucket: bucketName }, done);
  });

  describe('on an empty bucket', () => {
    it('calls the callback without an error', done => {
      flushS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();
        done();
      });
    });

    it('does not call the callback immediatly', done => {
      let test = false;
      flushS3Bucket(s3, bucketName, () => {
        expect(test).toBe(true);
        done();
      });
      test = true;
    });
  });

  describe('on an unversioned bucket with an item', () => {
    beforeEach(done => {
      s3.putObject({ Bucket: bucketName, Key: 'test' }, done);
    });

    it('calls the callback without an error', done => {
      flushS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();
        done();
      });
    });

    it('removes the item', done => {
      flushS3Bucket(s3, bucketName, () => {
        s3.getObject({ Bucket: bucketName, Key: 'test' }, (_err, data) => {
          expect(data).toBe(null);
          done();
        });
      });
    });
  });

  describe('on a versioned bucket with an item', () => {
    beforeEach(async () => {
      await s3
        .putBucketVersioning({
          Bucket: bucketName,
          VersioningConfiguration: {
            Status: 'Enabled'
          }
        })
        .promise();

      await s3.putObject({ Bucket: bucketName, Key: 'test' }).promise();

      await s3
        .putObject({ Bucket: bucketName, Key: 'test', Body: 'version2' })
        .promise();

      await s3.deleteObject({ Bucket: bucketName, Key: 'test' }).promise();
    });

    it('calls the callback without an error', done => {
      flushS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();
        done();
      });
    });

    it('does not leave any objects', done => {
      flushS3Bucket(s3, bucketName, () => {
        s3.listObjects({ Bucket: bucketName }, (_err, data) => {
          expect(data.Contents).toEqual([]);
          done();
        });
      });
    });

    it('does not leave any versions', done => {
      flushS3Bucket(s3, bucketName, () => {
        s3.listObjectVersions({ Bucket: bucketName }, (_err, data) => {
          expect(data.Versions).toEqual([]);
          done();
        });
      });
    });

    it('does not leave any delete markers', done => {
      flushS3Bucket(s3, bucketName, () => {
        s3.listObjectVersions({ Bucket: bucketName }, (_err, data) => {
          expect(data.DeleteMarkers).toEqual([]);
          done();
        });
      });
    });
  });

  describe('on a versioned bucket with over 1000 items', () => {
    beforeEach(async () => {
      await s3
        .putBucketVersioning({
          Bucket: bucketName,
          VersioningConfiguration: {
            Status: 'Enabled'
          }
        })
        .promise();

      await timesLimit(1100, 100, (n: number) =>
        s3.putObject({ Bucket: bucketName, Key: `item-${n}` }).promise()
      );

      await timesLimit(502, 100, (n: number) =>
        s3.deleteObject({ Bucket: bucketName, Key: `item-${n}` }).promise()
      );
    }, 15000);

    /**
     * Do all assertations in one block since the setup takes so long.
     */
    it('works', done => {
      flushS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();

        Promise.all([
          (async () => {
            const data = await s3.listObjects({ Bucket: bucketName }).promise();

            expect(data.Contents).toEqual([]);
          })(),
          (async () => {
            const data = await s3
              .listObjectVersions({ Bucket: bucketName })
              .promise();

            expect(data.Versions).toEqual([]);
            expect(data.DeleteMarkers).toEqual([]);
          })()
        ])
          .then(() => done())
          .catch(done.fail);
      });
    });
  });
});
