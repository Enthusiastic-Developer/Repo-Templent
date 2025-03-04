const axios = require('axios');
const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const issueBody = github.context.payload.issue.body || "No description provided.";
    const issueNumber = github.context.payload.issue.number;
    const repoOwner = github.context.repo.owner;
    const repoName = github.context.repo.repo;

    const octokit = github.getOctokit(process.env.GITHUB_TOKEN);

    // Fetch existing labels on the issue
    const { data: existingLabels } = await octokit.rest.issues.listLabelsOnIssue({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber
    });

    const existingLabelNames = existingLabels.map(label => label.name.toLowerCase());

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

    console.log("Calling Gemini API...");
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Classify this GitHub issue into one of these categories: bug, chore, documentation, enhancement, feature freeze, feature, feedback, new branch, performance, question, refactor, release notes, security, task, test improvement, test, won't fix. Issue: '${issueBody}'`
              }
            ]
          }
        ]
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.status !== 200) throw new Error(`API error: ${response.status} ${response.statusText}`);

    const classification = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase();
    console.log(`AI Classification: ${classification}`);

    const finalLabel = classificationMap[classification] || "Status: Awaiting Review";

    // If classification label is already present, do not add "Awaiting Review"
    if (existingLabelNames.includes(finalLabel.toLowerCase())) {
      console.log(`Label "${finalLabel}" already exists. No need to assign "Awaiting Review".`);
      return;
    }

    console.log(`Final Label Assigned: ${finalLabel}`);

    // Assign label
    await octokit.rest.issues.addLabels({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      labels: [finalLabel]
    });

    // Add comment
    await octokit.rest.issues.createComment({
      owner: repoOwner,
      repo: repoName,
      issue_number: issueNumber,
      body: `🤖 AI has classified this issue as **${finalLabel}**. If this is incorrect, please update the labels manually.`
    });

  } catch (error) {
    console.error("Error during AI classification:", error);
  }
}

run();
