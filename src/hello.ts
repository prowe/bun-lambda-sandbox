import { Serve } from "bun";

const serveOptions: Serve = {
    port: 8888,
    async fetch(request) {
        console.log('got request: ', await request.text());
        return new Response('Hello world');
    }
}

export default serveOptions;