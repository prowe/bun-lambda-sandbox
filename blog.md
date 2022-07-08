
I'm standing in checkout line at the grocery store. I pop open Twitter to see if there is any news and I seeKent C. Dodds retweeting [this tweet](https://twitter.com/suchipi/status/1544429805898149888?cxt=HHwWgMCtkbmu9e4qAAAA) announcing a new JavaScript runtime called [Bun](https://bun.sh). I have been casually following [Deno](https://deno.land) for a while with an interest in its native support for Typescript. I have been held back from using by the fact that most libraries in the server-side ecosystem assume that they are running under NodeJS and have access to all the Node APIs.

The interesting thing about Bun is that it claims "Bun natively implements hundreds of Node.js and Web APIs, including ~90% of Node-API functions (native modules), fs, path, Buffer and more."

The [installation instructions](https://github.com/Jarred-Sumner/bun#install) are pretty simple:
```bash
curl https://bun.sh/install | bash
```

Let's see if we can get a simple GraphQL server running.
The [built in http server](https://github.com/Jarred-Sumner/bun#bunserve---fast-http-server) is pretty simple.
First, in an empty folder, add the bun Typescript definitions:
```bash
bun add bun-types
```

Then we can create a `tsconfig.json` per [these instructions]:
```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "module": "esnext",
    "moduleResolution": "NodeNext",
    "target": "esnext",
    "types": ["bun-types"]
  }
}

```

Now we can create a simple HTTP server by just exporting the right structure
```Typescript
import { Serve } from "bun";

const serveOptions: Serve = {
    port: 8888,
    async fetch(request) {
        console.log('got request');
        return new Response('Hello world');
    }
}

export default serveOptions;
```

Then just run `bun src/hello.ts` and we can hit it with curl:
```bash
curl http://localhost:8888
Hello world
```

Great! Now lets create a GraphQL server.
Since we are using the built in Bun server, we don't want to use a GraphQL server framework.
Instead we can just use the [Graphql-js]() library with some help from [@graphql-tools/schema]().

First install some depencencies:
```bash
bun add graphql @graphql-tools/schema
```

Then, create a GraphQL schema file:
```GraphQL
type Query {
    greeting: String!
}
```

We can then create a super simple "Hello World" API. 
Create an `src/index.ts` file with the following content:
```Typescript
import { readFileSync } from 'fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { Serve } from 'bun';

const typeDefs = readFileSync('./schema.graphql', 'utf-8');

const resolvers = {
    Query: {
        greeting: () => `Hello World`
    }
}

const schema = makeExecutableSchema({
    typeDefs,
    resolvers
});

interface GraphQLRequest {
    query: string;
    variables?: {
        readonly [variable: string]: unknown;
    };
    operation?: string;
}

// This is the glue that takes a request and executes it as a GraphQL operation
const serveOptions: Serve = {
  port: 8888,
  async fetch(request) {
    const payload = (await request.json()) as unknown as GraphQLRequest
    const result = await graphql({
      schema,
      source: payload.query,
      variableValues: payload.variables,
      operationName: payload.operation
    });
    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}
  
export default serveOptions;
```

If we run `bun src/index.ts` we should be able to hit this with a request and get some content back:
```bash
curl --request POST \
  --url http://localhost:8888/ \
  --header 'Content-Type: application/json' \
  --data '{"query":"{ __typename greeting }"}'
{"data":{"__typename":"Query","greeting":"Hello World"}}
```

This is handy, but how to run it? One of the lowest operational cost ways to run a server is on AWS Lambda.
Unfortunatly, Lambda does not support a Bun runtime. 
It does, however, support [custom runtimes](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-custom.html).
So we can create a custom runtime.

First, we can follow [this tutorial](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-walkthrough.html) just to get a hang of the structure.
It wants us to start by creating an execution role. 
I am going to skip that step because the serverless transform will handle that later.

Next, we create a `bootstrap` file using the [example](https://docs.aws.amazon.com/lambda/latest/dg/runtimes-walkthrough.html#runtimes-walkthrough-function). This is the entrypoint that Lambda will invoke:
```bash
#!/bin/sh

set -euo pipefail

# Initialization - load function handler
source $LAMBDA_TASK_ROOT/"$(echo $_HANDLER | cut -d. -f1).sh"

# Processing
while true
do
  HEADERS="$(mktemp)"
  # Get an event. The HTTP request will block until one is received
  EVENT_DATA=$(curl -sS -LD "$HEADERS" -X GET "http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/next")

  # Extract request ID by scraping response headers received above
  REQUEST_ID=$(grep -Fi Lambda-Runtime-Aws-Request-Id "$HEADERS" | tr -d '[:space:]' | cut -d: -f2)

  # Run the handler function from the script
  RESPONSE=$($(echo "$_HANDLER" | cut -d. -f2) "$EVENT_DATA")

  # Send the response
  curl -X POST "http://${AWS_LAMBDA_RUNTIME_API}/2018-06-01/runtime/invocation/$REQUEST_ID/response"  -d "$RESPONSE"
done
```

And the `function.sh` handler:
```bash
function handler () {
  EVENT_DATA=$1
  echo "$EVENT_DATA" 1>&2;
  RESPONSE="Echoing request: '$EVENT_DATA'"

  echo $RESPONSE
}
```

Remember to make them executable:
```bash
chmod +x bootstrap function.sh
```

I don't like creating AWS resources via the console or CLI because they tend to get lost and are hard to cleanup.
I would rather create them via CloudFormation and deployed via the Serverless Application Model (SAM) tool.
Let's create a `samconfig.toml` file to hold the default arguments for deployment:
```toml
version=0.1

[default.global.parameters]
stack_name = "bun-graphql-sandbox"
region = "us-east-1"

[default.deploy.parameters]
resolve_s3 = "true"
fail_on_empty_changeset = "false"
capabilities = "CAPABILITY_IAM"
```

Then we can create a `template.yml` file with a [Serverless Function](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-function.html) resource:
```yml
Transform: AWS::Serverless-2016-10-31
Resources:
  SampleFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: '.'
      Runtime: provided
      Handler: function.handler

Outputs:
  SampleFunctionName:
    Value: !Ref SampleFunction
```

The SAM CLI will create a zip of the current directory (CodeUri) and upload it to S3.
It will then deploy our stack using that S3 URL.
We can deploy it by running `sam deploy`.

Once deployed, SAM will output the name of our function.
We can then invoke our function like so (replacing with your function name):
```bash
aws lambda invoke \
  --function-name bun-graphql-sandbox-SampleFunction-8JTd50moauca \
  --payload '{"text":"Hello"}' \
  --cli-binary-format raw-in-base64-out \
  response.txt
cat response.txt
Echoing request: '{"text":"Hello"}'
```

That's great. It might be pretty hard to package up an entire runtime in a zip.
For that, we can use the ability for lambda to use a Docker container as its deployment package.
We can follow the instructions for [building a container image](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-using-build.html#build-container-image).

To have a place to put our image, tell SAM that we want it to manage a container repo by setting `resolve_image_repos = "true"` in `samconfig.toml`.
We can then create a `Dockerfile`:
```
FROM public.ecr.aws/lambda/provided:al2

# LAMBDA_TASK_ROOT is set by the lambda image
WORKDIR ${LAMBDA_TASK_ROOT}

COPY bootstrap function.sh ./

# we need to set this here so our bootstrap script works since images don't have handlers
ENV _HANDLER function.handler

ENTRYPOINT ["./bootstrap"]
```

Then update our Lambda definition in `template.yml` to specify the image we are building for SAM:
```yaml
  SampleFunction:
    Type: AWS::Serverless::Function
    Metadata:
      DockerContext: .
      Dockerfile: Dockerfile
    Properties:
      PackageType: Image
      ImageUri: samplefunction:latest
```

Since we are changing the `PackageType` we have to re-create our Lambda.
Then we can build and deploy our new image and Cloudformation stack:
```bash
sam delete
sam build
sam deploy
```

Invoke our lambda with the its new name and we should get the same result:
```bash
aws lambda invoke \
  --function-name bun-graphql-sandbox-SampleFunction-8JTd50moauca \
  --payload '{"text":"Hello"}' \
  --cli-binary-format raw-in-base64-out \
  response.txt
cat response.txt
Echoing request: '{"text":"Hello"}'
```

The reason we did all of this is so that we can install the Bun runtime into the container and then use it.
We also probably want to replace the bash script that does the poll-invoke-callback loop with something that runs in Bun so that we
aren't starting up a new runtime on every invocation.

SAM provides a way to invoke a function locally without deploying it.
We can try it by running:
```bash
sam build
echo'{"text":"Hello"}' | sam local invoke SampleFunction --event -
```


