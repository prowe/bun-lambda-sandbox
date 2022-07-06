
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
        console.log('got request: ', await request.text(),);
        return new Response('Hello world');
    }
}

export default serveOptions;
```

Then just run `bun src/hello.ts` and we can hit it with curl:
```bash
curl http://localhost:8888
Hello worl
```