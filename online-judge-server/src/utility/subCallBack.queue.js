const Bull = require("bull");
const Submission = require("../models/submission.model");
const Execution = require("../models/execution.model");
const { UpdateScore } = require("../controllers/participant.controller");

const subCallBackQueue = new Bull("subCallback", {
  redis: {
    host: process.env.redisHost || "127.0.0.1",
    port: process.env.redisPort,
  },
});

// Redis Consumer : Executing after Producer adds data to queue
const submissionProcess = async (job) => {
  const callbackBody = job.data;
  try {
    // Decoding all the Base64 encoded fields
    callbackBody.stdout = Buffer.from(
      callbackBody.stdout || "",
      "base64"
    ).toString("ascii");
    callbackBody.message = Buffer.from(
      callbackBody.message || "",
      "base64"
    ).toString("ascii");
    callbackBody.stderr = Buffer.from(
      callbackBody.stderr || "",
      "base64"
    ).toString("ascii");
    callbackBody.compile_output = Buffer.from(
      callbackBody.compile_output || "",
      "base64"
    ).toString("ascii");

    // Update the Execution Model with body
    const executionBody = await Execution.findOneAndUpdate(
      { token: callbackBody.token },
      callbackBody,
      { new: true }
    ).lean();

    console.log("Call back hit", {
      SubmissionID: executionBody.submissionId.toString(),
      Status: callbackBody.status.description,
    });

    // If status of submission is Accepted ( 3 ) then update score
    if (callbackBody.status.id == 3) {
      const updatedSubmission = await Submission.findOneAndUpdate(
        { _id: executionBody.submissionId },
        { $inc: { score: 10, passedCases: 1, checkedCases: 1 } },
        { upsert: true, new: true }
      );
      console.log("Submission score added");
      const participantScore = await UpdateScore(
        updatedSubmission.contestId,
        updatedSubmission.userId,
        updatedSubmission.score,
        updatedSubmission.questionId
      );

      // Else just increase checked cases count
    } else {
      const updatedSubmission = await Submission.findOneAndUpdate(
        { _id: executionBody.submissionId },
        { $inc: { checkedCases: 1 } },
        { upsert: true, new: true }
      );
    }
  } catch (err) {
    console.log(err.message);
  }
};

subCallBackQueue.process(submissionProcess);

module.exports = { subCallBackQueue };
