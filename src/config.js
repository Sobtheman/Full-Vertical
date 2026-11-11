// Everything that needs a real destination lives here.
// Empty string = not connected yet (the site says so instead of faking it).
export const config = {
  // Calendar link for "Book a free call" (Calendly, Cal.com, ...).
  // Empty: the buttons scroll to the contact form.
  bookingUrl: '',

  // Endpoint that receives the contact form as JSON (planned: Resend via a Vercel function).
  // Empty: the form validates but tells the visitor it isn't connected.
  contactEndpoint: '',

  // Social profile URLs. Empty: the icon shows but is marked "coming soon".
  social: {
    x: '',
    instagram: '',
    linkedin: '',
  },
};
