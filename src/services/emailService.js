const { BrevoClient } = require("@getbrevo/brevo");

const client = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

exports.sendEmail = async (to, subject, htmlContent) => {
  await client.transactionalEmails.sendTransacEmail({
    sender: { email: process.env.BREVO_SENDER_EMAIL, name:process.env.BREVO_SENDER_NAME},
    to: [{ email: to }],
    subject,
    htmlContent,
  });
};