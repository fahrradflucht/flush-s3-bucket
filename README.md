# flush-s3-bucket

> Delete all files in an S3 bucket.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [API](#api)
- [Maintainers](#maintainers)
- [Contribute](#contribute)
- [License](#license)

## Install

```
$ npm install flush-s3-bucket
```

or

```
$ yarn add flush-s3-bucket
```

## Usage

```js
import { S3 } from 'aws-sdk';
import { flushS3Bucket } from 'flush-s3-bucket';

/**
 * For details on configuration (e.g. credentials) refer to:
 * https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/configuring-the-jssdk.html
 */
const s3 = new S3();

flushS3Bucket(s3, 'my-bucket-name', err => {
  if (!err) {
    console.log('The bucket is empty!');
  }
});
```

No need to checkout
[`@types`](https://github.com/DefinitelyTyped/DefinitelyTyped). Since the
package itself is written in TypeScript typings are included.

## Maintainers

[@fahrradflucht](https://github.com/fahrradflucht)

## Contribute

PRs accepted.

### Running the tests

Since the task of the library is inherently bound to an external service
mocking would probably make the tests useless. Therefore all tests
integration level and need a S3 endpoint which is configurable through the
`S3_ENDPOINT` environment variable.

The tests are known to run successfully against
[`zenko/cloudserver`](https://hub.docker.com/r/zenko/cloudserver/) and
obviously real AWS S3 (which nonetheless is not recommended due to cost and
speed) while they are known to fail against
[`localstack/localstack`](https://hub.docker.com/r/localstack/localstack/) because
of bugs in its versioning implementation (though the library should still
work on unversioned localstack buckets).

## License

MIT © 2018 Mathis Wiehl (@fahrradflucht)
