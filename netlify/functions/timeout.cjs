/**
 * timeout.cjs — intentional timeout function for error-handling tests.
 *
 * Netlify enforces a maximum execution time of 10 s (Starter) or 26 s (Pro).
 * This function sleeps for 30 seconds, which exceeds both limits and causes
 * Netlify to return a 502 "Function execution timed out" response.
 *
 * Accessible at: /.netlify/functions/timeout
 */

"use strict";

const SLEEP_MS = 900_000; // 15 minutes — far beyond any Netlify plan's execution limit

exports.handler = async function handler(_event, _context) {
  await new Promise((resolve) => setTimeout(resolve, SLEEP_MS));

  return {
    statusCode: 502,
    body: "502 Bad Gateway",
  };
};
