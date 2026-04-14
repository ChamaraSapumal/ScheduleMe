export const sendWelcomeEmail = async (userEmail: string, userName: string) => {
  const firstName = userName ? userName.split(' ')[0] : 'Student';

  // Light Premium Purple Theme
  const theme = {
    background: '#F8F5FF',
    primary: '#3E315A',
    secondary: '#6D5A96',
    accent: '#D2B9FF',
    card: '#FFFFFF',
  };

  // Google Drive public image link for student-studying.png (If user has a gdrive link, they can replace the ID below)
  // Or they can use a generic premium 3D student avatar hosted on a fast CDN.
  // For now, using a highly reliable placeholder that matches the aesthetic.
  const imageUrl = "https://images.unsplash.com/photo-1740252117012-bb53ad05e370?q=80&w=2080&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Welcome to ScheduleMe</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          background-color: ${theme.background};
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: ${theme.card};
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 15px 35px rgba(62, 49, 90, 0.05);
        }
        .header {
          background-color: ${theme.primary};
          padding: 40px 20px;
          text-align: center;
        }
        .header img {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          border: 4px solid rgba(255, 255, 255, 0.2);
          object-fit: cover;
        }
        .header h1 {
          color: #FFFFFF;
          font-size: 28px;
          font-weight: 800;
          margin: 20px 0 0 0;
          letter-spacing: -0.5px;
        }
        .content {
          padding: 40px 40px;
          color: ${theme.primary};
        }
        .greeting {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 15px;
        }
        .message {
          color: ${theme.secondary};
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        .features {
          background-color: ${theme.background};
          border-radius: 15px;
          padding: 25px;
          margin-bottom: 30px;
        }
        .features h3 {
          margin-top: 0;
          font-size: 16px;
          color: ${theme.primary};
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .feature-item {
          display: flex;
          align-items: flex-start;
          margin-bottom: 15px;
        }
        .feature-icon {
          color: ${theme.secondary};
          font-size: 20px;
          margin-right: 15px;
        }
        .feature-text {
          font-size: 15px;
          color: ${theme.secondary};
          line-height: 1.5;
        }
        .footer {
          text-align: center;
          padding: 30px;
          background-color: #F0EAFB;
          color: ${theme.secondary};
          font-size: 13px;
        }
        .btn {
          display: inline-block;
          background-color: ${theme.primary};
          color: #FFFFFF !important;
          text-decoration: none;
          padding: 14px 30px;
          border-radius: 30px;
          font-weight: 700;
          font-size: 16px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <!-- Replace this URL with your custom hosted image (e.g. Imgur, or direct Google Drive link format) -->
          <img src="${imageUrl}" alt="Student Avatar" />
          <h1>Master The Grind.</h1>
          <p style="color: #D2B9FF; font-size: 15px; margin: 0; opacity: 0.9;">Welcome to your new academic hub.</p>
        </div>
        <div class="content">
          <div class="greeting">Hi there,</div>
          <div class="message">
            Welcome to ScheduleMe! We built this app because we know university life is absolutely chaotic. Between back-to-back lectures, impossible assignments, and surviving exam season, it's easy to let things slip through the cracks. <span style="color: #3E315A; font-weight: 600;">Not anymore.</span>
          </div>
          
          <div class="features">
            <h3>Your New Arsenal:</h3>
            
            <div class="feature-item">
              <span class="feature-text"><strong style="color: #3E315A; display: block; margin-bottom: 4px;">📅 Smart Timetable Sync</strong> Never show up to the wrong lecture hall again. Scan, store, and manage your entire semester's schedule instantly.</span>
            </div>
            
            <div class="feature-item">
              <span class="feature-text"><strong style="color: #3E315A; display: block; margin-bottom: 4px;">⚡ Deep Work / Pomodoro</strong> Beat procrastination when an assignment is due at 11:59 PM. Built-in focus timers designed to force you into extreme study sessions.</span>
            </div>
            
            <div class="feature-item">
              <span class="feature-text"><strong style="color: #3E315A; display: block; margin-bottom: 4px;">🔒 Encrypted Emergency Notes</strong> Need to quickly dump dorm Wi-Fi passwords or sudden ideas? Lock your private thoughts behind military-grade biometric encryption.</span>
            </div>
            
            <div class="feature-item">
              <span class="feature-text"><strong style="color: #3E315A; display: block; margin-bottom: 4px;">🚀 Growth Tracking</strong> Take a break from textbooks. Track your personal habits, build your vocabulary, and stack up achievements offline.</span>
            </div>
          </div>
          
          <div class="message" style="text-align: center;">
            <p>Ready to get your life together?</p>
            <a href="#" class="btn">Open ScheduleMe</a>
          </div>
        </div>
        
        <div class="footer">
          &copy; ${new Date().getFullYear()} ScheduleMe.<br>
          Built by students, for students.<br><br>
          <small>You got this email because you signed up for ScheduleMe.</small>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: 'service_918zc5o',
        template_id: 'template_t63gc1k',
        user_id: '-nDh195Bj8d29sajx', // Public Key
        template_params: {
          email: userEmail,       // Must match {{email}} in your EmailJS template "To" field
          html_content: htmlContent // Must match {{{html_content}}} in your "Content" field
        }
      }),
    });

    if (!response.ok) {
      console.log('EmailJS Error:', await response.text());
    } else {
      console.log('Welcome Email Sent Successfully!');
    }
  } catch (error) {
    console.log('Failed to send email:', error);
  }
};
