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

### Authentication Management

- **Log In and Save Authentication Credentials**

  ```bash
  gmail auth login
  ```

  This command initializes the OAuth process, saves the credentials upon successful authentication, and prepares the tool for accessing Gmail features.

- **Log Out and Clear Authentication Credentials**
  ```bash
  gmail auth logout
  ```
  Use this command to remove stored credentials from your system, effectively logging you out and securing your session.

### Listing Labels

- **List All Labels**
  ```bash
  gmail labels list --output <format>
  ```
  This command lists all labels in your Gmail account. You can specify the output format using the `--output` option. Available formats include `json`, `csv`, `text`, `table`, and `markdown`.

### Searching Emails

- **Search Emails Based on Criteria**
  ```bash
  gmail emails search --keyword "<keyword>" --from "<email>" --to "<email>" --label "<label>" --startDate "YYYY-MM-DD" --endDate "YYYY-MM-DD" --output <format> --limit <number> --batch-size <size>
  ```
  Use this command to search for emails that match specified criteria. Here's a breakdown of the options:
  - `--keyword <keyword>`: Search for this keyword within the email body or subject.
  - `--from <email>`: Filter emails sent from a specific address.
  - `--to <email>`: Filter emails sent to a specific address.
  - `--label <label>`: Filter emails by Gmail label.
  - `--startDate "YYYY-MM-DD"` and `--endDate "YYYY-MM-DD"`: Specify a date range for filtering emails.
  - `--output <format>`: Choose the format for the search results output. Options are `json`, `csv`, `text`, `table`, and `markdown`.
  - `--limit <number>`: Limit the number of results returned.
  - `--batch-size <size>`: Break the search into batches, specified either as a number of batches or a time interval (e.g., '3' for three batches, '1 month' for monthly batches).

### Example Usages

#### 1. **Simple Email Search**

Search for all emails from "example@domain.com" between January 1, 2023, and January 31, 2023, outputting the results in JSON format:

```bash
gmail emails search --from "example@domain.com" --startDate "2023-01-01" --endDate "2023-01-31" --output json
```

This command will search for emails sent from the specified address within the given date range and display the results in JSON format.

#### 2. **Batched Email Search with Time Interval**

Search for emails using a specific keyword "urgent" over a three-month period, batched into monthly searches:

```bash
gmail emails search --keyword "urgent" --startDate "2023-01-01" --endDate "2023-03-31" --batch-size "1 month" --output table
```

This command will break down the search into monthly intervals, searching for emails that contain the keyword "urgent" in each month separately, and display results in a table format.

#### 3. **Batched Email Search with Numeric Division**

Search for emails between two individuals over a year, divided into 4 quarterly searches:

```bash
gmail emails search --from "user1@domain.com" --to "user2@domain.com" --startDate "2023-01-01" --endDate "2023-12-31" --batch-size 4 --output markdown
```

This command will divide the year into four equal periods and perform the search for emails exchanged between the two specified addresses over each quarter, displaying the results in markdown format.

#### 4. **Logout and Clear Credentials**

Clear stored credentials to secure the session after your operations:

```bash
gmail auth logout
```

This command removes stored authentication credentials, effectively logging out the user and securing the session.

#### 5. **Listing Email Labels**

List all labels in your Gmail account in a table format:

```bash
gmail labels list --output table
```

This command lists all available Gmail labels in a table format, making it easy to view and manage your email categorizations.

## Disclaimers

This tool is provided as-is, without warranty of any kind. It is not intended for public use and no support or maintenance will be provided. Users must follow all guidelines and best practices provided by Google for using Gmail API resources, including managing and safeguarding authentication credentials.

## Contributing

While this tool is not intended for public development, contributions to the repository may be considered on a case-by-case basis. If you have a feature request or bug report, please open an issue in the repository.
