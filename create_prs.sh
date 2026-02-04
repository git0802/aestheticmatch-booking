#!/bin/bash

# Define co-authors' names and emails
COAUTHOR_1_NAME="windev0609"
COAUTHOR_1_EMAIL="talentdev0226@outlook.com"

# Loop to create and merge pull requests 10 times
for i in {1..10}
do
    # Make a change in the dev branch
    echo "NEW_ENV_VARIABLE='value'" >> index.js

    git add index.js

    # Commit with multiple co-authors using a here document
    git commit -F - <<EOF
Update index.js for change #$i.

Co-authored-by: $COAUTHOR_1_NAME <$COAUTHOR_1_EMAIL>
EOF

    # Push changes to the dev branch
    git push origin develop

    # Create a pull request from dev to main using GitHub CLI
    pr_number=$(gh pr create --base main --head develop --title "Merge dev to main for change #$i" --body "Merging changes from develop to main for change #$i.")

    echo "Created pull request #$pr_number"

    # Merge the pull request
    gh pr merge $pr_number --merge
    echo "Merged pull request #$pr_number"

    # Optional: Wait for a short period to ensure timing
    sleep_duration=$((RANDOM % 3 + 1))  # Random sleep between 1 and 3 seconds
    echo "Sleeping for $sleep_duration seconds..."
    sleep $sleep_duration  # Sleep for the random duration
done
