const express=require('express')
const cors=require('cors')
const jwt = require('jsonwebtoken');
const nodemailer=require("nodemailer");
const axios = require('axios')
const fs = require('fs'); 
const Razorpay = require('razorpay');
const crypto = require('crypto');
const router = express.Router();


const app=express()
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json())
const {signup,login,forget} =require('./databse')
const path = require('path');

const SECRET_KEY = '72';

const transporter=nodemailer.createTransport(
  {
      secure:true,
      host:'smtp.gmail.com',
      port:465,
      auth:{
          user:'devgrover72@gmail.com',
          pass:'gzjn fxab mowq drij'
      }

  }
)
app.post('/api/send-confirmation-email', async (req, res) => {
  try {
    const { email, orderId, paymentId, cartItems, totalAmount } = req.body;
    console.log('Received email request for:', email);

    // Format order items for email
    const itemsList = cartItems.map(item => 
      `<tr>
        <td>${item.name} (x${item.quantity})</td>
        <td>₹${item.price * item.quantity}</td>
      </tr>`
    ).join('');

    const mailOptions = {
      from: 'Explora <devgrover72@gmail.com>',
      to: email,
      subject: `Order Confirmation - #${orderId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
            .details { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { text-align: left; padding: 8px; background-color: #f2f2f2; }
            td { padding: 8px; border-bottom: 1px solid #ddd; }
            .total-row { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Order Confirmed!</h1>
          </div>
          
          <div class="content">
            <p>Thank you for shopping with us. Your order has been confirmed!</p>
            
            <div class="details">
              <h2>Order Summary</h2>
              <p><strong>Order ID:</strong> ${orderId}</p>
              <p><strong>Payment ID:</strong> ${paymentId}</p>
              
              <h3>Items Ordered:</h3>
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsList}
                  <tr class="total-row">
                    <td>Total Paid:</td>
                    <td>₹${totalAmount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <p>We'll notify you when your items ship. If you have any questions, please contact our support team.</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} Explora. All rights reserved.</p>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    res.json({ 
      success: true,
      message: 'Confirmation email sent successfully'
    });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send email',
      details: error.message 
    });
  }
});
const razorpay = new Razorpay({
    key_id: 'rzp_test_Syu8Zea6zXm8yN',
    key_secret: 'X2gjximlzuwl2JDPKI7Wgd2O'
});
app.post('/create-order', async (req, res) => {
  const { amount } = req.body;

  try {
    const order = await razorpay.orders.create({
      amount: amount, // amount should already be multiplied by 100 in frontend
      currency: 'INR',
      receipt: 'receipt_' + Math.floor(Date.now() / 1000),
      payment_capture: 1
    });

    res.status(200).json(order);
  } catch (error) {
    console.error('Order creation failed:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});
app.post('/verify-payment', async (req, res) => {
  const { paymentId, orderId, signature, amount, cartItems } = req.body;

  try {
    // 1. Generate the expected signature
    const hmac = crypto.createHmac('sha256', 'X2gjximlzuwl2JDPKI7Wgd2O'); // Your Razorpay key_secret
    hmac.update(orderId + "|" + paymentId);
    const generatedSignature = hmac.digest('hex');
    
    // 2. Compare signatures
    if (generatedSignature === signature) {
      // 3. Save successful payment to database (simplified example)
      const orderData = {
        orderId,
        paymentId,
        signature,
        amount: amount / 100, // Convert back to rupees
        items: cartItems,
        status: 'completed',
        date: new Date()
      };
      
      // Here you would typically save to database
      console.log('Payment verified and order saved:', orderData);
      
      res.status(200).json({ 
        success: true, 
        message: 'Payment verified successfully',
        order: orderData
      });
    } else {
      console.error('Signature mismatch:', { generatedSignature, receivedSignature: signature });
      res.status(400).json({ 
        success: false, 
        error: 'Payment verification failed: Signature mismatch' 
      });
    }
  } catch (err) {
    console.error('Verification error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error during verification' 
    });
  }
});
let userBookings = [];
const cityServices = [
    {
      id: 1,
      location: 'New York',
      description: 'A bustling metropolis known for its iconic landmarks.',
      image: 'http://localhost:8000/images/cultural.jpg',
      price: '$200 per day',
    },
   
  ];
  
const otpStore = {};

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, query } = req.body;
    if (!name || !email || !phone || !query) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (query.length < 20 || query.length > 200) {
      return res.status(400).json({ error: 'Query must be 20-200 characters' });
    }

    
    const mailOptions = {
      from: 'devgrover72@gmail.com',
      to: 'devgr102@gmail.com',
      subject: 'New Contact Form Submission',
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Query:</strong></p>
        <p>${query}</p>
        <p>Received at: ${new Date().toLocaleString()}</p>
      `
    };
   
    await transporter.sendMail(mailOptions);
    
    res.status(200).json({ message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});
function sendmail(to,sub,msg){
    transporter.sendMail(
        {
            to:to,
            subject:sub,
            html:msg
        }
    )
}
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000);
}

app.post('/bookings', (req, res) => {
    const { userId, serviceId, location, tickets, price } = req.body; 
    const booking = {
      userId,
      serviceId,
      location,
      tickets,
      totalAmount: price * tickets,
      date: new Date().toLocaleDateString(), 
    };
    
    userBookings.push(booking); 
    res.status(200).json({ message: 'Booking confirmed', booking });
  });
  app.get('/user-bookings/:userId', (req, res) => {
    const { userId } = req.params; 
    const bookings = userBookings.filter(booking => booking.userId === userId); 
    if (bookings.length > 0) {
      res.status(200).json(bookings);
    } else {
      res.status(200).json({ message: 'No active bookings' });
    }
  });

app.post('/sent-otp', async (req, res) => {
    const { email } = req.body;
    const otp = generateOtp(); 
    otpStore[0] = otp; 

    console.log(`OTP generated for ${email}: ${otp}`); 
    sendmail(email, "Verification Code", `Your OTP is: ${otp}`);

    res.status(200).json({ status: 'OTP sent' }); 
});
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    console.log(`Verifying OTP for email: ${email}`); 
    console.log(`Stored OTP: ${otpStore[0]}`);

    if (otpStore[0] && otpStore[0].toString() === otp) {
        delete otpStore[0]; 
        return res.status(200).json({ status: 'Success', message: 'OTP verified successfully.' });
    } else {
        return res.status(400).json({ status: 'Failed', message: 'Invalid or expired OTP.' });
    }
});
app.post('/login', async (req, res) => {
    const data = req.body;
    console.log(data);
   signup(data); 

});

app.post('/loginpage', async (req, res) => {
    
        const data = req.body;
        const result = await login(data);

        if (result) {
            const token = jwt.sign({ email:result.email }, SECRET_KEY, { expiresIn: '10s' });
            res.status(200).json({ status: 'Success', name: result.name,token }); 
        } 
        else{
            res.json('Error')
        }
});
app.post('/forget',async(req,res)=>{
    const data=req.body
    const result= await forget(data)
    console.log(result)
    if(result){
res.status(200).json('Success')
    }
    else{
        res.json('Error')
    }
})
app.get('/services', async (req, res) => {
    try {
      const response = await axios.get('https://restcountries.com/v3.1/all'); 
      const services = response.data.map((country) => ({
        id: country.cca3,
        location: country.name.common,
        description: country.region,
        image: country.flags.png,
        price: '$2000',
      }));
  
      res.status(200).json(services.slice(0, 20));
    } catch (error) {
      console.error('Error fetching services:', error);
      res.status(500).json({ message: 'Error fetching services' });
    }
  });
  
  app.get('/services/:serviceId', async (req, res) => {
    const serviceId = req.params.serviceId;
  
    try {
      const response = await axios.get(`https://restcountries.com/v3.1/alpha/${serviceId}`);
      const country = response.data[0];
  
      const serviceDetails = {
        id: country.cca3,
        location: country.name.common,
        description: country.region,
        image: country.flags.png,
        price: '2000', 
      };
  
      res.status(200).json(serviceDetails);
    } catch (error) {
      console.error('Error fetching service details:', error);
      res.status(500).json({ message: 'Error fetching service details' });
    }
  });

  app.use('/api', router);
app.listen(8000,()=>{
    console.log('server on..')
})