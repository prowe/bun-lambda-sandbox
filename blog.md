
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

If we run `bun src/index.ts` we should be able to hit this with a request and get some content back.

