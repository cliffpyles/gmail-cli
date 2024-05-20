#! /usr/bin/env node

const fs = require("fs").promises;
const path = require("path");
const process = require("process");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const { program } = require("commander");
const { createWriteStream } = require("fs");
const { format } = require("util");
const { Table } = require("console-table-printer"); // npm install console-table-printer for table output

program.version("1.0.0").description("CLI tool for Gmail operations");

// If modifying these scopes, delete token.json.
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
 * Constructs a Gmail search query from multiple search criteria.
 * @param {Object} criteria Criteria to include in search (keyword, from, to, label, startDate, endDate).
 * @returns {string} Constructed search query string.
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
 * @param {String} format Format to use (json, csv, text, table, markdown).
 */
function formatOutput(data, formatType) {
  switch (formatType) {
    case "json":
      console.log(JSON.stringify(data, null, 2));
      break;
    case "csv":
      const headers = Object.keys(data[0]);
      console.log(headers.join(","));
      data.forEach((item) => {
        console.log(headers.map((header) => item[header]).join(","));
      });
      break;
    case "text":
      data.forEach((item) => {
        console.log(format("%s from %s on %s: %s", item.subject, item.from, item.date, item.snippet));
      });
      break;
    case "table":
      const p = new Table({
        columns: [
          { name: "subject", alignment: "left" },
          { name: "from", alignment: "left" },
          { name: "date", alignment: "left" },
          { name: "snippet", alignment: "left" },
        ],
      });
      p.addRows(data);
      p.printTable();
      break;
    case "markdown":
      console.log("| Subject | From | Date | Snippet |");
      console.log("|---------|------|------|---------|");
      data.forEach((item) => {
        console.log(`| ${item.subject} | ${item.from} | ${item.date} | ${item.snippet} |`);
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
 * Searches emails in the user's Gmail inbox based on provided criteria and displays detailed information.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {Object} criteria Search criteria.
 * @returns {Promise<Array>} List of email messages that match the criteria, with detailed information.
 */
async function searchEmails(auth, criteria) {
  const gmail = google.gmail({ version: "v1", auth });
  const query = constructSearchQuery(criteria);

  try {
    const listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
    });

    if (!listResponse.data.messages) {
      console.log("No messages found.");
      return [];
    }

    const messages = listResponse.data.messages;
    console.log(`Found ${messages.length} messages. Fetching details...`);

    const detailedMessages = await Promise.all(
      messages.map(async (message) => {
        const msgResponse = await gmail.users.messages.get({
          userId: "me",
          id: message.id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = msgResponse.data.payload.headers;
        let details = {
          id: message.id,
          threadId: message.threadId,
          snippet: msgResponse.data.snippet,
          from: headers.find((header) => header.name === "From")?.value,
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
  .command("setup")
  .description("Setup or refresh authentication credentials.")
  .action(async () => {
    const client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
      await saveCredentials(client);
      console.log("Authentication successful and saved.");
    }
  });

auth
  .command("clear")
  .description("Clear saved authentication credentials.")
  .action(async () => {
    try {
      await fs.unlink(TOKEN_PATH);
      console.log("Credentials cleared successfully.");
    } catch (error) {
      console.error("Failed to clear credentials:", error);
    }
  });

const labels = program.command("labels").description("Operations related to labels");
labels
  .command("list")
  .description("List all labels.")
  .action(async () => {
    const auth = await authorize();
    await listLabels(auth);
  });

// Search emails command under Gmail
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
  .option("--output <format>", "Output format: json, csv, text, table, markdown", "json")
  .action(async (options) => {
    const criteria = {
      keyword: options.keyword,
      from: options.from,
      to: options.to,
      label: options.label,
      startDate: options.startDate,
      endDate: options.endDate,
    };
    const auth = await authorize();
    const messages = await searchEmails(auth, criteria);
    formatOutput(messages, options.output);
  });

program.parse(process.argv);
