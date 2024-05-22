#!/usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const { program } = require("commander");
const { format } = require("util");
const { Table } = require("console-table-printer");
const { parse, add, differenceInCalendarDays } = require("date-fns");
program.version("1.0.0").description("CLI tool for Gmail operations");

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

/**
 * Constructs a Gmail search query string from provided search criteria.
 * This function builds a query string that can be used with the Gmail API to
 * filter results based on specific fields like keywords in the email body or subject,
 * sender, recipient, label, and date ranges.
 *
 * @param {Object} criteria - An object containing the search criteria.
 * @param {string} [criteria.keyword] - Keyword to search in the body or subject of the email.
 * @param {string} [criteria.from] - Email address of the sender to filter results.
 * @param {string} [criteria.to] - Email address of the recipient to filter results.
 * @param {string} [criteria.label] - Label to filter the emails.
 * @param {string} [criteria.startDate] - Start date to filter emails that are newer (format: YYYY/MM/DD).
 * @param {string} [criteria.endDate] - End date to filter emails that are older (format: YYYY/MM/DD).
 * @returns {string} - A string that represents the Gmail search query based on the given criteria.
 */
function constructSearchQuery(criteria) {
  const queryParts = [];

  if (criteria.keyword) {
    queryParts.push(`(${criteria.keyword} in:body OR ${criteria.keyword} in:subject)`);
  }
  if (criteria.from) {
    queryParts.push(`from:${criteria.from}`);
  }
  if (criteria.to) {
    queryParts.push(`to:${criteria.to}`);
  }
  if (criteria.label) {
    queryParts.push(`label:${criteria.label}`);
  }
  if (criteria.startDate && criteria.endDate) {
    queryParts.push(`after:${criteria.startDate} before:${criteria.endDate}`);
  } else if (criteria.startDate) {
    queryParts.push(`after:${criteria.startDate}`);
  } else if (criteria.endDate) {
    queryParts.push(`before:${criteria.endDate}`);
  }

  return queryParts.join(" ");
}

/**
 * Format data according to specified format.
 * @param {Array} data Data to format.
 * @param {String} formatType Format to use (json, csv, text, table, markdown).
 */
function formatOutput(data, formatType) {
  switch (formatType) {
    case "json":
      console.log(JSON.stringify(data, null, 2));
      break;
    case "csv":
      if (data.length === 0) {
        console.log("No data available.");
        return;
      }
      const headers = Object.keys(data[0]);
      console.log(headers.join(","));
      data.forEach((item) => console.log(headers.map((header) => `"${item[header]}"`).join(",")));
      break;
    case "text":
      data.forEach((item) =>
        console.log(format("%s from %s on %s: %s", item.subject, item.from, item.date, item.snippet))
      );
      break;
    case "table":
      const p = new Table({
        columns: Object.keys(data[0]).map((key) => ({ name: key, alignment: "left" })),
      });
      p.addRows(data);
      p.printTable();
      break;
    case "markdown":
      console.log("| " + Object.keys(data[0]).join(" | ") + " |");
      console.log(
        "|" +
          Object.keys(data[0])
            .map(() => "---")
            .join("|") +
          "|"
      );
      data.forEach((item) =>
        console.log(
          "| " +
            Object.keys(item)
              .map((key) => item[key])
              .join(" | ") +
            " |"
        )
      );
      break;
    case "jsonl":
      data.forEach((item) => {
        console.log(JSON.stringify(item));
      });
      break;
    default:
      console.error("Invalid format specified");
      break;
  }
}

/**
 * Lists the labels in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
async function listLabels(auth) {
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.labels.list({
    userId: "me",
  });
  const labels = res.data.labels;
  if (!labels || labels.length === 0) {
    console.log("No labels found.");
    return;
  }
  console.log("Labels:");
  labels.forEach((label) => {
    console.log(`- ${label.name}`);
  });
}

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Parses batch size and unit, or returns an integer count for equal batch partitioning.
 * @param {string|number} batchSize - Batch size in days, weeks, months or integer for equal division.
 * @param {string} startDate - Start date in ISO format.
 * @param {string} endDate - End date in ISO format.
 * @returns {Array} Array of date intervals { start: Date, end: Date }
 */
function parseBatchSize(batchSize, startDate, endDate) {
  const start = parse(startDate, "yyyy-MM-dd", new Date());
  const end = parse(endDate, "yyyy-MM-dd", new Date());

  const intervals = [];

  if (Number.isInteger(Number(batchSize))) {
    const totalDays = differenceInCalendarDays(end, start);
    const daysPerBatch = Math.floor(totalDays / batchSize);

    let currentStart = start;
    for (let i = 0; i < batchSize; i++) {
      let currentEnd = add(currentStart, { days: daysPerBatch });
      if (i === batchSize - 1) {
        currentEnd = end;
      }
      intervals.push({ start: currentStart, end: currentEnd });
      currentStart = add(currentEnd, { days: 1 });
    }
  } else {
    const [amount, unit] = batchSize.split(" ");
    const duration = {};
    const normalizedUnit = unit.endsWith("s") ? unit : `${unit}s`;
    duration[normalizedUnit] = parseInt(amount);

    const incrementDate = (date) => add(date, duration);

    let currentStart = start;
    while (currentStart < end) {
      let nextStart = incrementDate(currentStart);
      intervals.push({ start: currentStart, end: nextStart > end ? end : nextStart });
      currentStart = nextStart;
    }
  }

  return intervals.map((interval) => ({
    start: interval.start,
    end: interval.end,
  }));
}

/**
 * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: "authorized_user",
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.writeFile(TOKEN_PATH, payload);
}

/**
 * Searches emails in the user's Gmail inbox based on provided criteria and fetches detailed information
 * for each message. The detailed information includes fields such as the message ID, thread ID, snippet,
 * sender, subject, and date. This function first lists messages that match the search criteria, then
 * fetches each message's details via separate API calls.
 *
 * @param {google.auth.OAuth2} auth - An authorized OAuth2 client instance to authenticate the request.
 * @param {Object} criteria - Search criteria used to filter messages.
 * @param {string} [criteria.keyword] - Keyword to search in the body or subject of the email.
 * @param {string} [criteria.from] - Email address of the sender to filter results.
 * @param {string} [criteria.to] - Email address of the recipient to filter results.
 * @param {string} [criteria.label] - Label to filter the emails.
 * @param {string} [criteria.startDate] - Start date to filter emails that are newer.
 * @param {string} [criteria.endDate] - End date to filter emails that are older.
 * @param {number} [criteria.limit] - Maximum number of results to return.
 * @returns {Promise<Array>} - A promise that resolves to an array of objects, each representing detailed information about an email.
 * @throws {Error} - Throws an error if the API returns an error or if the query fails to execute.
 */
async function searchEmails(auth, { keyword, from, to, label, startDate, endDate, limit }) {
  const gmail = google.gmail({ version: "v1", auth });
  const query = constructSearchQuery({ keyword, from, to, label, startDate, endDate });

  try {
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: limit || 500,
    });

    if (!listResponse.data.messages) {
      return [];
    }

    const messages = listResponse.data.messages;
    const detailedMessages = await Promise.all(
      messages.map(async (message) => {
        const msgResponse = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata",
          metadataHeaders: ["From", "To", "Subject", "Date"],
        });

        const headers = msgResponse.data.payload.headers;
        let details = {
          id: message.id,
          threadId: message.threadId,
          snippet: msgResponse.data.snippet,
          from: headers.find((header) => header.name === "From")?.value,
          to: headers.find((header) => header.name === "To")?.value,
          subject: headers.find((header) => header.name === "Subject")?.value,
          date: headers.find((header) => header.name === "Date")?.value,
        };
        return details;
      })
    );

    return detailedMessages;
  } catch (error) {
    console.error("The API returned an error: " + error);
    throw error;
  }
}

const auth = program.command("auth").description("Authentication management");
auth
  .command("login")
  .description("Setup or refresh authentication credentials.")
  .action(async () => {
    const client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
      console.log("Logged in successfully.");
    }
  });
auth
  .command("logout")
  .description("Clear saved authentication credentials.")
  .action(async () => {
    try {
      await fs.unlink(TOKEN_PATH);
      console.log("Logged out successfully.");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  });

const labels = program.command("labels").description("Operations related to labels");
labels
  .command("list")
  .description("List all labels.")
  .option("--output <format>", "Output format: json, jsonl, csv, text, table, markdown", "json")
  .action(async (options) => {
    const auth = await authorize();
    const labels = await listLabels(auth);
    formatOutput(
      labels.map((label) => ({ name: label.name })),
      options.output
    );
  });

const emails = program.command("emails").description("Operations related to emails");
emails
  .command("search")
  .description("Search emails based on criteria.")
  .option("--keyword <string>", "Keyword to search in the body or subject")
  .option("--from <string>", "Sender email address")
  .option("--to <string>", "Recipient email address")
  .option("--label <string>", "Gmail label")
  .option("--startDate <date>", "Start date for the email search")
  .option("--endDate <date>", "End date for the email search")
  .option("--output <format>", "Output format: json, jsonl, csv, text, table, markdown", "json")
  .option("--limit <number>", "Limit the number of results", parseInt)
  .option("--batch-size <size>", "Break search into batches, size in number or unit (e.g., '1 month')", 1)
  .action(async (options) => {
    const criteria = {
      keyword: options.keyword,
      from: options.from,
      to: options.to,
      label: options.label,
      startDate: options.startDate,
      endDate: options.endDate,
      limit: options.limit,
    };
    const auth = await authorize();
    const dateRanges = parseBatchSize(options.batchSize, options.startDate, options.endDate);
    let allMessages = [];

    for (const range of dateRanges) {
      criteria.startDate = range.start.toISOString().slice(0, 10);
      criteria.endDate = range.end.toISOString().slice(0, 10);
      const messages = await searchEmails(auth, criteria);
      allMessages.push(...messages);
    }

    if (options.limit) {
      allMessages = allMessages.slice(0, options.limit);
    }
    formatOutput(allMessages, options.output);
  });

program.parse(process.argv);
