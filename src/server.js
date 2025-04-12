const express=require('express')
const cors=require('cors')
const jwt = require('jsonwebtoken');
const nodemailer=require("nodemailer");
const axios = require('axios')
const fs = require('fs'); 
const Razorpay = require('razorpay');
const crypto = require('crypto');
const router = express.Router();

let lastPurchase = null;

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
app.post('/send-order-confirmation', async (req, res) => {
  try {
    const { orderId, paymentId, cartItems, totalAmount } = req.body;

    // Format order items for email
    const itemsList = cartItems.map(item => 
      `${item.name} (x${item.quantity}) - ₹${item.price * item.quantity}`
    ).join('<br>');

    const mailOptions = {
      from: 'devgrover72@gmail.com',
      to: 'devgr102@gmail.com', // Always send to this address
      subject: `New Order #${orderId}`,
      html: `
        <h1>New Order Received!</h1>
        <p>You have received a new order with the following details:</p>
        
        <h2>Order Information</h2>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Payment ID:</strong> ${paymentId}</p>
        
        <h3>Items Ordered:</h3>
        ${itemsList}
        
        <h3>Total Amount: ₹${totalAmount}</h3>
        
        <p>Order received at: ${new Date().toLocaleString()}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('Order confirmation email sent to devgr102@gmail.com');
    res.status(200).json({ success: true, message: 'Order details emailed successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send order details',
      details: error.message 
    });
  }
});
const razorpay = new Razorpay({
    key_id: 'rzp_test_Syu8Zea6zXm8yN',
    key_secret: 'X2gjximlzuwl2JDPKI7Wgd2O'
});

app.post('/api/confirm-purchase', async (req, res) => {
  try {
    const { items, total, paymentMethod } = req.body;
    
    const purchase = {
      _id: Date.now().toString(),
      items: items.map(item => ({
        medicine_id: item.id,
        name: item.name,
        image: item.image,
        quantity: item.quantity,
        price: item.price
      })),
      total_payment: total,
      payment_method: paymentMethod,
      purchase_date: new Date()
    };
    
    lastPurchase = purchase; // Store in memory
    
    res.json({
      success: true,
      purchase: purchase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to process purchase"
    });
  }
});

router.post('/last-purchase', (req, res) => {
  console.log('lastPurchase:', lastPurchase);
  if (!lastPurchase) {
    return res.status(404).json({ error: "No recent purchases found" });
  }
  res.json(lastPurchase);
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
app.get('/admin/logged-users', async (req, res) => {
  try {
    const dbInstance = await getDb();
    const collection = dbInstance.collection('users');
    
    
    const users = await collection.find({ loggedInAt: { $exists: true } }).toArray();
    
    res.status(200).json(users);
  } catch (err) {
    console.error('Error fetching logged users:', err);
    res.status(500).json({ error: 'Failed to fetch logged-in users' });
  }
});


app.get('/admin/user-activities', async (req, res) => {
  try {
    const dbInstance = await getDb();
    const collection = dbInstance.collection('activities');
    const data = await collection.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      }
    ]).toArray();

    res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching activities:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
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

app.post('/send-status-email', async (req, res) => {
  const { userName, medicineName, decision } = req.body;

  const statusMessage = decision === 'approved'
    ? `Hello ${userName}, your order for ${medicineName} is confirmed and will be delivered within 2 days.`
    : `Hello ${userName}, your order for ${medicineName} has been denied by the admin.`;

  const mailOptions = {
    from: 'devgrover72@gmail.com',
    to: 'devgr102@gmail.com',
    subject: `Order Status for ${medicineName}`,
    text: statusMessage
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Status email sent for ${medicineName} (${decision})`);
    res.status(200).json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending status email:', error);
    res.status(500).json({ success: false, error: 'Failed to send email' });
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