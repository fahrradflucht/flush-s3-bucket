import { series, timesLimit } from 'async';
import { S3 } from 'aws-sdk';
import { randomBytes } from 'crypto';
import { pourOutS3Bucket } from '.';

const clientConfiguration = {
  endpoint: process.env['S3_ENDPOINT'] || 'http://localhost:8000',
  s3ForcePathStyle: true
};

const createBucketName = (extension: string) =>
  `awesome-test-bucket-${extension}`;

describe('pourOutS3Bucket', () => {
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
      pourOutS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();
        done();
      });
    });

    it('does not call the callback immediatly', done => {
      let test = false;
      pourOutS3Bucket(s3, bucketName, error => {
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
      pourOutS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();
        done();
      });
    });

    it('removes the item', done => {
      pourOutS3Bucket(s3, bucketName, error => {
        s3.getObject({ Bucket: bucketName, Key: 'test' }, (err, data) => {
          expect(data).toBe(null);
          done();
        });
      });
    });
  });

  describe('on a versioned bucket with an item', () => {
    beforeEach(done => {
      series(
        [
          cb =>
            s3.putBucketVersioning(
              {
                Bucket: bucketName,
                VersioningConfiguration: {
                  Status: 'Enabled'
                }
              },
              cb
            ),
          cb => s3.putObject({ Bucket: bucketName, Key: 'test' }, cb),
          cb =>
            s3.putObject(
              { Bucket: bucketName, Key: 'test', Body: 'version2' },
              cb
            ),
          cb => s3.deleteObject({ Bucket: bucketName, Key: 'test' }, cb)
        ],
        done
      );
    });

    it('calls the callback without an error', done => {
      pourOutS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();
        done();
      });
    });

    it('does not leave any objects', done => {
      pourOutS3Bucket(s3, bucketName, error => {
        s3.listObjects({ Bucket: bucketName }, (err, data) => {
          expect(data.Contents).toEqual([]);
          done();
        });
      });
    });

    it('does not leave any versions', done => {
      pourOutS3Bucket(s3, bucketName, error => {
        s3.listObjectVersions({ Bucket: bucketName }, (err, data) => {
          expect(data.Versions).toEqual([]);
          done();
        });
      });
    });

    it('does not leave any delete markers', done => {
      pourOutS3Bucket(s3, bucketName, error => {
        s3.listObjectVersions({ Bucket: bucketName }, (err, data) => {
          expect(data.DeleteMarkers).toEqual([]);
          done();
        });
      });
    });
  });

  describe('on a versioned bucket with over 1000 items', () => {
    beforeEach(done => {
      series(
        [
          next =>
            s3.putBucketVersioning(
              {
                Bucket: bucketName,
                VersioningConfiguration: {
                  Status: 'Enabled'
                }
              },
              next
            ),
          next => {
            timesLimit(
              1100,
              100,
              (n: number, created: () => void) => {
                s3.putObject({ Bucket: bucketName, Key: `item-${n}` }, created);
              },
              next
            );
          },
          next => {
            timesLimit(
              502,
              100,
              (n: number, created: () => void) => {
                s3.deleteObject(
                  { Bucket: bucketName, Key: `item-${n}` },
                  created
                );
              },
              next
            );
          }
        ],
        done
      );
    }, 15000);

    /**
     * Do all assertations in one block since the setup takes so long.
     */
    it('works', done => {
      pourOutS3Bucket(s3, bucketName, error => {
        expect(error).toBeFalsy();
        series(
          [
            next =>
              s3.listObjects({ Bucket: bucketName }, (err, data) => {
                expect(data.Contents).toEqual([]);
                next();
              }),
            next =>
              s3.listObjectVersions({ Bucket: bucketName }, (err, data) => {
                expect(data.Versions).toEqual([]);
                expect(data.DeleteMarkers).toEqual([]);
                next();
              })
          ],
          done
        );
      });
    });
  });
});
