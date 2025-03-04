const axios = require("axios");
const { Octokit } = require("@octokit/core");

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function classifyIssue() {
  try {
    const { data: issue } = await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}", {
      owner: process.env.GITHUB_REPOSITORY.split("/")[0],
      repo: process.env.GITHUB_REPOSITORY.split("/")[1],
      issue_number: process.env.GITHUB_EVENT_PATH ? require(process.env.GITHUB_EVENT_PATH).issue.number : 1,
    });

    const issueBody = issue.body;

    // Call OpenAI to classify issue
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        { role: "system", content: "Classify the following GitHub issue into one of these categories: bug, feature request, documentation, security, performance, chore." },
        { role: "user", content: issueBody },
      ],
    }, {
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const classification = response.data.choices[0].message.content.trim().toLowerCase();

    const labels = {
      "bug": "Type: Bug",
      "feature request": "Type: Feature",
      "documentation": "Type: Documentation",
      "security": "Type: Security",
      "performance": "Type: Performance",
      "chore": "Type: Chore"
    };

    if (labels[classification]) {
      await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/labels", {
        owner: process.env.GITHUB_REPOSITORY.split("/")[0],
        repo: process.env.GITHUB_REPOSITORY.split("/")[1],
        issue_number: issue.number,
        labels: [labels[classification]]
      });
    }

    // Post a comment with classification
    await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
      owner: process.env.GITHUB_REPOSITORY.split("/")[0],
      repo: process.env.GITHUB_REPOSITORY.split("/")[1],
      issue_number: issue.number,
      body: `🤖 AI has classified this issue as **${classification}**. If this is incorrect, please update the labels manually.`
    });

    console.log(`Issue classified as: ${classification}`);
  } catch (error) {
    console.error("Error classifying issue:", error);
  }
}

classifyIssue();
