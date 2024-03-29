const Submission = require("../models/submission.model");
const Question = require("../models/question.model");
const Execution = require("../models/execution.model");
const { produceSubmission } = require("../utility/submission.queue");
const { submissionProcess } = require("../utility/subCallBack.queue");

// This is where Judge0 will send back the status of code execution
const subCallBackURL = `${process.env.callBack}/callback/sub`;

// Create Submission by sending Judge0 with source_code, language_id and callback_url
// Token received back from Judge0 is stored along with code and other important ids
// NOTE: Judge0 sends code execution status on callback_url having PUT request in router

async function submit(req, res) {
  const { languageId, code, userId, questionId, contestId } = req.body;
  try {
    if (languageId && userId && questionId && contestId && code) {
      // Find Question by questionId and save Test Cases
      const question = await Question.findOne({
        _id: questionId,
        contestId: contestId,
      }).lean();

      if (!question) {
        return res.status(404).send("Question Not Found");
      }

      const testCase = question.example;
      const maxScore = question.score;
      const questionName = question.title;

      // Create a new Submision when user clicks on Submit
      const newSubmission = await Submission.create({
        userId: userId,
        contestId: contestId,
        questionId: questionId,
        questionName: questionName,
        maxScore: maxScore,
        maxCases: testCase.length,
      });

      // Encode Input (stdin), Output (expected_output) and code (source_code) to base64
      const testInput = testCase.map(({ input }) =>
        Buffer.from(input).toString("base64")
      );
      const testOutput = testCase.map(({ output }) =>
        Buffer.from(output).toString("base64")
      );
      const encodedCode = Buffer.from(code).toString("base64");

      // Making array of same submission but different test cases
      const postData = testInput.map((element, index) => ({
        language_id: languageId,
        source_code: encodedCode,
        stdin: element,
        expected_output: testOutput[index],
        callback_url: subCallBackURL,
        number_of_runs: 1,
        submissionId: newSubmission._id,
      }));

      // Calling Redis to make Queue
      postData.map((data) => produceSubmission(data));

      res.send(newSubmission._id);
    } else {
      res.status(400).send("Invalid data received, send valid data");
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
}

// Get submission if exists using ./submission/:submissionId

async function getSubmission(req, res) {
  try {
    const submission = await Submission.findOne({ _id: req.params.submissionId });

    if (submission) {
      
      //If all checked only then send executions(Test Cases Details)
      if(submission.checkedCases==submission.maxCases){
        const executions = await Execution.find({ submissionId: submission._id });
        
        //If all cases passed then send last 3 or less(if 3 not present) number of executions 
        if(submission.passedCases==submission.maxCases){
          
          const lastExecutions = (executions.length>=3) ? executions.slice(-3): executions; 
          
          res.send({ submission: submission, executions: lastExecutions }); 
        
        //If partial passed or failed then send first wrong found execution
        }else{
          
          const lastExecution = executions.find(element => {
            return element.status.id>3;
          });
          
          res.send({ submission: submission, executions: [lastExecution] });
        }

      //If all cases not checked then send send only submission details and no test cases details
      }else{
        res.send({ submission: submission, executions: [] });
      }
    
    } else {
      res.status(404).send("No submissions exists with such token");
    }
  } catch (err) {
    res.status(400).send(err.message);
  }
}

// get all submissions

async function getAllSubmissions(req, res) {
  try {
    const list = await Submission.find({});
    res.send(list);
  } catch (err) {
    res.status(401).send(err.message);
  }
}

// get user submissions

async function getUserSubmissions(req, res) {
  try {
    const { userId } = req.params;
    const submissions = await Submission.find({ userId: userId }).sort({ timestamp : -1 });
    res.send(submissions);
  } catch (err) {
    res.status(401).send(err.message);
  }
}

// get user submissions for a question

async function getUserSubmissionForQuestion(req, res) {
  try {
    const { userId, questionId } = req.params;
    const submissions = await Submission.find({ userId, questionId });
    res.send(submissions);
  } catch (err) {
    res.status(401).send(err.message);
  }
}

module.exports = {
  submit,
  getSubmission,
  getAllSubmissions,
  getUserSubmissions,
  getUserSubmissionForQuestion,
};
