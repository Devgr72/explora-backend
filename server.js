const express=require('express')
const cors=require('cors')
const jwt = require('jsonwebtoken');
const nodemailer=require("nodemailer");
const axios = require('axios')
const fs = require('fs'); 
const Razorpay = require('razorpay');

const app=express()
app.use(cors())
app.use(express.json())
const {signup,login,forget} =require('./databse')
const path = require('path');

const SECRET_KEY = '72';


const razorpay = new Razorpay({
    key_id: 'rzp_test_Syu8Zea6zXm8yN',
    key_secret: 'X2gjximlzuwl2JDPKI7Wgd2O'
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
      date: new Date().toLocaleDateString(), // Date of booking
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

app.post('/create-order', async (req, res) => {
    const { amount } = req.body; 

    const options = {
        amount: amount * 100, 
        currency: 'INR',
        receipt: 'order_rcptid_11',
        payment_capture: 1
    };

    try {
        const order = await razorpay.orders.create(options);
        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create order' });
    }
});
app.listen(8000,()=>{
    console.log('server on..')
})