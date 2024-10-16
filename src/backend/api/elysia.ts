/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 2)
 *
 * tl;dr - this is where all the Elysia server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import type { ElysiaConfig } from "elysia";
import Elysia from "elysia";

// import { auth } from '@/server/auth'
// import { db } from '@/server/db'

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * @see https://elysiajs.com/essential/life-cycle.html#derive
 */
// const createContext = new Elysia()
//   .derive(async () => {
//     const session = await auth()

//     return { db, session }
//   })
//   .as('plugin')

/**
 * Middleware for timing the execution of each request.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = new Elysia()
  .state({ start: 0 })
  .onBeforeHandle(({ store }) => (store.start = Date.now()))
  .onAfterHandle(({ path, store: { start } }) =>
    console.log(`[Elysia] ${path} took ${Date.now() - start}ms to execute`)
  )
  .as("plugin");

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and middleware to the server.
 */
export const createElysia = <P extends string, S extends boolean>(
  options?: ElysiaConfig<P, S>
) =>
  new Elysia({
    ...options,
  }).onError(({ error, set }) => {
    const prismaError = error as PrismaClientKnownRequestError;

    if ((error as any).response) {
      return error;
    }

    if (!(error as any).type) {
      switch (prismaError.code) {
        case "P2002":
          // handling duplicate key errors
          set.status = 400;
          return {
            message: `${prismaError?.meta?.target}: field value already exists. Please enter a unique value.`,
          };
        case "P2014":
          // handling invalid id errors
          set.status = 400;
          return { message: `Invalid ID: ${prismaError?.meta?.target}` };
        case "P2003":
          // handling invalid data errors
          set.status = 400;
          return {
            message: `Invalid input data: ${prismaError?.meta?.target}`,
          };
        default:
          // handling all other errors
          return { message: `Something went wrong: ${prismaError.message}` };
      }
    }
    return JSON.parse(error.message);
  });
