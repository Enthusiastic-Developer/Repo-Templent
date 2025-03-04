const axios = require('axios');
const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const issueBody = github.context.payload.issue.body || "No description provided.";

    const classificationMap = {
      "bug": "Type: Bug",
      "chore": "Type: Chore",
      "documentation": "Type: Documentation",
      "enhancement": "Type: Enhancement",
      "feature freeze": "Type: Feature Freeze",
      "feature": "Type: Feature",
      "feedback": "Type: Feedback",
      "new branch": "Type: New branch",
      "performance": "Type: Performance",
      "question": "Type: Question",
      "refactor": "Type: Refactor",
      "release notes": "Type: Release Notes",
      "security": "Type: Security",
      "task": "Type: Task",
      "test improvement": "Type: Test Improvement",
      "test": "Type: Test",
      "won't fix": "Won't fix"
    };

    console.log("Calling OpenAI API...");
    const response = await axios.post("https://api.openai.com/v1/chat/completions", {
      model: "gpt-4",
      messages: [
        { role: "system", content: "Classify this GitHub issue into one of these categories: bug, chore, documentation, enhancement, feature freeze, feature, feedback, new branch, performance, question, refactor, release notes, security, task, test improvement, test, won't fix." },
        { role: "user", content: issueBody }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status !== 200) throw new Error(`API error: ${response.status} ${response.statusText}`);

    const classification = response.data.choices?.[0]?.message?.content?.trim().toLowerCase();
    console.log(`AI Classification: ${classification}`);

    const finalLabel = classificationMap[classification] || "Status: Awaiting Review";
    console.log(`Final Label Assigned: ${finalLabel}`);

    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);
    const issueNumber = github.context.payload.issue.number;

    await octokit.rest.issues.addLabels({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber,
      labels: [finalLabel]
    });

    await octokit.rest.issues.createComment({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      issue_number: issueNumber,
      body: `🤖 AI has classified this issue as **${finalLabel}**. If this is incorrect, please update the labels manually.`
    });

  } catch (error) {
    console.error("Error during AI classification:", error);
  }
}

run();
