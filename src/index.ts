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


