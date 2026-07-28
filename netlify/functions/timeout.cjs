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

const SLEEP_MS = 30_000; // 30 seconds — safely over the 10 s / 26 s limits

exports.handler = async function handler(_event, _context) {
  await new Promise((resolve) => setTimeout(resolve, SLEEP_MS));

  // This response is never actually sent — Netlify will have already timed out.
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "This should never be returned." }),
  };
};
