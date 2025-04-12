const {MongoClient}=require('mongodb')

const uri="mongodb://localhost:27017"
const con=new MongoClient(uri)
const getDb=async()=>{
    const db=await con.db('test')
    console.log("sucessss...")
    return db
}
const db=getDb()

const signup = async (obj) => {
  const collection = (await db).collection('users');
  await collection.insertOne(obj);  
}
const login=async(obj)=>{
    const collection=(await db).collection('users')
    const user = await collection.findOne({email:obj.email});
    await collection.updateOne(
      { email: obj.email },
      { $set: { loggedInAt: new Date() } }
    );
    console.log(user)
    if (user) {
      if (user.pass === obj.pass) {
        return { name: user.name };
      } else {
        return false;
      }
    } else {
      return false;
    }

}
const forget=async(obj)=>{
  const collection=(await db).collection('users')
  const user1 = await collection.findOne({email:obj.email});
  console.log(user1)
  if (user1) {
    const result = await collection.updateOne(
        { email:obj.email},
        { $set:{pass:obj.pass} });
    return true;
}
else{
return false;
}
}

module.exports={signup,login,forget}