# Gmail CLI

## Overview

This CLI tool allows you to interact with your Gmail account to perform operations such as listing email labels and searching through emails based on specific criteria. **This tool is intended for my personal use**. Users interested in using this tool can do so by cloning the repository and setting up the necessary configurations locally.

## Prerequisites

To use this tool, ensure you have the following:

- Node.js installed on your system.
- Access to a Google Cloud Platform account with the Gmail API enabled.
- A project set up in the Google Developers Console with OAuth 2.0 credentials created.

## Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/cliffpyles/gmail-cli.git
   cd gmail-cli
   ```

2. **Install Dependencies and Link the Tool**

   ```bash
   npm install
   npm link
   ```

3. **Set Up Google API Credentials**

   - Navigate to the [Google Developers Console](https://console.developers.google.com/).
   - Create a new project or select an existing one.
   - Enable the Gmail API under **Library**.
   - Go to **Credentials**, click **Create Credentials**, and select **OAuth client ID**.
   - Follow the prompts to configure the OAuth consent screen.
   - Select the application type (Desktop app), name your OAuth 2.0 client, and create it.
   - Download the JSON file containing your credentials and save it as `credentials.json` in the project directory.

4. **Authorize the Application**
   - Run the setup command to authorize your application:
     ```bash
     gmail auth setup
     ```

## Usage

### Managing Authentication

- **Set Up or Refresh Authentication Credentials**

  ```bash
  gmail auth setup
  ```

  This command configures your credentials for use with the Gmail API, storing them for future sessions.

- **Clear Saved Authentication Credentials**
  ```bash
  gmail auth clear
  ```
  Use this command to remove saved credentials from your system.

### Listing Labels

- **List All Labels**
  ```bash
  gmail labels list --output <format>
  ```
  This command lists all labels in your Gmail account. You can specify the output format using the `--output` option. Available formats include `json`, `csv`, `text`, `table`, and `markdown`.

### Searching Emails

- **Search Emails Based on Criteria**
  ```bash
  gmail emails search --keyword "<keyword>" --from "<email>" --to "<email>" --label "<label>" --startDate "YYYY-MM-DD" --endDate "YYYY-MM-DD" --output <format> --limit <number>
  ```
  Use this command to search for emails that match specified criteria. Here's a breakdown of the options:
  - `--keyword <keyword>`: Search for this keyword within the email body or subject.
  - `--from <email>`: Filter emails sent from a specific address.
  - `--to <email>`: Filter emails sent to a specific address.
  - `--label <label>`: Filter emails by Gmail label.
  - `--startDate "YYYY-MM-DD"` and `--endDate "YYYY-MM-DD"`: Specify a date range for filtering emails.
  - `--output <format>`: Choose the format for the search results output. Options are `json`, `csv`, `text`, `table`, and `markdown`.
  - `--limit <number>`: Limit the number of results returned.

## Disclaimers

This tool is provided as-is, without warranty of any kind. It is not intended for public use and no support or maintenance will be provided. Users must follow all guidelines and best practices provided by Google for using Gmail API resources, including managing and safeguarding authentication credentials.

## Contributing

While this tool is not intended for public development, contributions to the repository may be considered on a case-by-case basis. If you have a feature request or bug report, please open an issue in the repository.
