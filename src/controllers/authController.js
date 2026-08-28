const AUTHORIZED_USERS = require('../config/authUsers');

// @desc    Authenticate user against authorized credentials list
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password'
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = AUTHORIZED_USERS.find(
      (u) => u.email.toLowerCase() === trimmedEmail && u.password === password
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Access restricted to authorized accounts only.'
      });
    }

    // Return user info and simulated auth token
    const token = `token_${Date.now()}_${Buffer.from(trimmedEmail).toString('base64')}`;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          email: user.email,
          name: user.name
        },
        token
      }
    });
  } catch (error) {
    console.error('Error in auth login:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message
    });
  }
};
