import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import RelatedDoctors from '../components/RelatedDoctors'
import { toast } from 'react-toastify'
import axios from 'axios'


const Appointment = () => {

  const { docId } = useParams()
  const { doctors, currencySymbol, backendUrl, token, getDoctorsData } = useContext(AppContext)
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const navigate = useNavigate();
  const [docInfo, setDocInfo] = useState(null);
  const [docSlots, setDocSlots] = useState([]);
  const [slotIndex, setSlotIndex] = useState(0);
  const [slotTime, setSlotTime] = useState('');
  const [userAppointments, setUserAppointments] = useState([]);

  const fetchDocInfo = async () => {
    const docInfo = doctors.find(doc => doc._id === docId);
    if (!docInfo) {
      console.error('Doctor not found for docId:', docId);
      // toast.error('Doctor not found');
      navigate('/');
      return;
    }
    setDocInfo(docInfo);
    console.log('Fetched docInfo.slots_booked:', docInfo.slots_booked);
  };

  const getAvailableSlots = async () => {
    if (!docInfo) return;

    let today = new Date();
    let slots = [];

    for (let i = 0; i < 7; i++) {
      let currentDate = new Date(today);
      currentDate.setDate(today.getDate() + i);
      let endTime = new Date(currentDate);
      endTime.setHours(21, 0, 0, 0);

      if (today.getDate() === currentDate.getDate()) {
        currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10);
        currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0);
      } else {
        currentDate.setHours(10);
        currentDate.setMinutes(0);
      }

      let timeSlots = [];
      while (currentDate < endTime) {
        let formattedTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
        let day = currentDate.getDate();
        let month = currentDate.getMonth() + 1;
        let year = currentDate.getFullYear();
        const slotDate = `${day}_${month}_${year}`; // e.g., 9_7_2025

        let isBooked = docInfo.slots_booked?.[slotDate]?.includes(formattedTime) || false;
        if (slotDate === '9_7_2025' && formattedTime === '06:00 PM') {
          console.log(`Slot 9_7_2025 06:00 PM: ${isBooked ? 'Booked' : 'Available'}`);
        }

        if (!isBooked) {
          timeSlots.push({
            datetime: new Date(currentDate),
            time: formattedTime,
          });
        }

        currentDate.setMinutes(currentDate.getMinutes() + 30);
      }

      if (timeSlots.length > 0) {
        slots.push(timeSlots);
      }
    }

    setDocSlots(slots);
    console.log('Generated docSlots:', slots.map(day => day.map(slot => slot.time)));
  };


  const fetchUserAppointments = async () => {
    if (!token) return;
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/my-appointments`, {
        headers: { token },
      });
      if (data.success) {
        // Filter appointments for this doctor
        const doctorAppointments = data.appointments.filter(appt => appt.docId === docId);
        setUserAppointments(doctorAppointments);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to fetch appointments');
    }
  };

  const bookAppointment = async () => {
    if (!token) {
      toast.warn('Please login to book an appointment');
      return navigate('/login');
    }
    if (!slotTime) {
      toast.warn('Please select a time slot');
      return;
    }
    try {
      const date = docSlots[slotIndex][0].datetime;
      let day = date.getDate();
      let month = date.getMonth() + 1;
      let year = date.getFullYear();
      const slotDate = `${day}_${month}_${year}`; // e.g., 9_7_2025
      const normalizedSlotTime = slotTime.toUpperCase(); // e.g., 05:00 PM

      console.log(`Booking slot: ${slotDate} at ${normalizedSlotTime}`);

      const { data } = await axios.post(
        `${backendUrl}/api/user/book-appointment`,
        { docId, slotDate, slotTime: normalizedSlotTime },
        { headers: { token } }
      );

      if (data.success) {
        toast.success(data.message);
        await getDoctorsData(); // Refresh doctor data
        await fetchDocInfo(); // Refresh docInfo to update slots_booked
        await fetchUserAppointments(); // Refresh user appointments
        setSlotTime(''); // Reset selected slot
        setSlotIndex(0); // Reset to first day
        console.log('Updated docInfo:', docInfo.slots_booked);
        navigate('/my-appointments');
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Booking error:', error);
      toast.error(error.response?.data?.message || 'Failed to book appointment');
    }
  };

  const cancelAppointment = async (appointmentId) => {
    if (!token) {
      toast.warn('Please login to cancel an appointment');
      return navigate('/login');
    }
    try {
      console.log(`Canceling appointment: ${appointmentId}`);
      const { data } = await axios.post(
        `${backendUrl}/api/user/cancel-appointment`,
        { appointmentId },
        { headers: { token } }
      );

      if (data.success) {
        toast.success(data.message);
        // Wait briefly for backend to update
        await new Promise(resolve => setTimeout(resolve, 500));
        await getDoctorsData(); // Refresh doctor data
        await fetchDocInfo(); // Refresh docInfo to update slots_booked
        await fetchUserAppointments(); // Refresh user appointments
        setSlotTime(''); // Reset selected slot
        setSlotIndex(0); // Reset to first day
        console.log('Post-cancellation docInfo.slots_booked:', docInfo?.slots_booked);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error('Cancellation error:', error.response?.data || error);
      toast.error(error.response?.data?.message || 'Failed to cancel appointment');
    }
  };

  useEffect(() => {
    fetchDocInfo();
  }, [doctors, docId]);

  useEffect(() => {
    getAvailableSlots();
  }, [docInfo]);

  useEffect(() => {
    fetchUserAppointments();
  }, [docInfo, token]);
  useEffect(() => {
    window.scrollTo(0, 0); // Scroll to top on component mount
  }, []);
  useEffect(() => {
    console.log(docSlots);
  }, [docSlots])

return docInfo && (
  <div>
    {/* Doctor detail */}
    <div className='flex flex-col sm:flex-row gap-4'>
      <div>
        <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt={docInfo.name} />
      </div>
      <div className='flex-1 border border-gray-400 rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>
        <p className='flex items-center gap-2 text-2xl font-medium text-gray-900'>
          {docInfo.name}
          <img className='w-5' src={assets.verified_icon} alt='Verified' />
        </p>
        <div className='flex items-center gap-2 text-sm mt-1 text-gray-600'>
          <p>{docInfo.degree} - {docInfo.speciality}</p>
          <button className='py-0.5 px-2 border text-xs rounded-full'>{docInfo.experience}</button>
        </div>
        <div>
          <p className='flex items-center gap-1 text-sm font-medium text-gray-900 mt-3'>
            About <img src={assets.info_icon} alt='Info' />
          </p>
          <p className='text-sm text-gray-500 max-w-[700px] mt-1'>{docInfo.about}</p>
        </div>
        <p className='text-gray-500 font-medium mt-4'>
          Appointment fee: <span className='text-gray-900'>{currencySymbol}{docInfo.fees}</span>
        </p>
      </div>
    </div>

    {/* Booking slots */}
    <div className='sm:ml-72 sm:pl-4 mt-4 font-medium text-gray-700'>
      <p>Booking slots</p>
      <div className='flex gap-3 items-center w-full overflow-x-scroll mt-4'>
        {docSlots.length &&
          docSlots.map((item, index) => (
            <div
              onClick={() => setSlotIndex(index)}
              className={`text-center py-6 min-w-16 rounded-full cursor-pointer ${
                slotIndex === index ? 'bg-primary text-white' : 'border border-gray-200'
              }`}
              key={index}
            >
              <p>{item[0] && daysOfWeek[item[0].datetime.getDay()]}</p>
              <p>{item[0] && item[0].datetime.getDate()}</p>
            </div>
          ))}
      </div>
      <div className='flex items-center gap-3 w-full overflow-x-scroll mt-4'>
        {docSlots.length &&
          docSlots[slotIndex]?.map((item, index) => (
            <p
              onClick={() => setSlotTime(item.time)}
              className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full cursor-pointer ${
                item.time === slotTime ? 'bg-primary text-white' : 'text-gray-400 border border-gray-300'
              }`}
              key={index}
            >
              {item.time}
            </p>
          ))}
      </div>
      <button
        onClick={bookAppointment}
        disabled={!slotTime}
        className={`bg-primary text-white text-sm font-light px-14 py-3 rounded-full my-6 ${
          !slotTime ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        Book an appointment
      </button>
    </div>

    {/* User Appointments */}
    {/* {userAppointments.length > 0 && (
      <div className='sm:ml-72 sm:pl-4 mt-4 font-medium text-gray-700'>
        <p>Your Appointments</p>
        <div className='mt-4'>
          {userAppointments.map((appt, index) => (
            <div
              key={index}
              className='flex justify-between items-center border p-4 rounded-lg mb-2'
            >
              <p>
                {appt.slotDate.replace('_', '-')} at {appt.slotTime}
              </p>
              {!appt.cancelled && (
                <button
                  onClick={() => cancelAppointment(appt._id)}
                  className='bg-red-500 text-white text-sm font-light px-4 py-2 rounded-full'
                >
                  Cancel Appointment
                </button>
              )}
              {appt.cancelled && (
                <p className='text-red-500 text-sm'>Cancelled</p>
              )}
            </div>
          ))}
        </div>
      </div>
    )} */}

    {/* Listing related doctors */}
    <RelatedDoctors docId={docId} speciality={docInfo.speciality} />
  </div>
);

      
  
}

export default Appointment




// import React, { useContext, useEffect, useState } from 'react'
// import { useNavigate, useParams } from 'react-router-dom'
// import { AppContext } from '../context/AppContext'
// import { assets } from '../assets/assets'
// import RelatedDoctors from '../components/RelatedDoctors'
// import { toast } from 'react-toastify'
// import axios from 'axios'

// const Appointment = () => {
//   const { docId } = useParams();
//   const { doctors, currencySymbol, backendUrl, token, getDoctorsData } = useContext(AppContext);
//   const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

//   const navigate = useNavigate();
//   const [docInfo, setDocInfo] = useState(null);
//   const [docSlots, setDocSlots] = useState([]);
//   const [slotIndex, setSlotIndex] = useState(0);
//   const [slotTime, setSlotTime] = useState('');

//   const fetchDocInfo = async () => {
//     const docInfo = doctors.find(doc => doc._id === docId);
//     setDocInfo(docInfo);
//   };

//   const getAvailableSlots = async () => {
//     if (!docInfo) return;

//     let today = new Date();
//     let slots = [];

//     for (let i = 0; i < 7; i++) {
//       let currentDate = new Date(today);
//       currentDate.setDate(today.getDate() + i);
//       let endTime = new Date(currentDate);
//       endTime.setHours(21, 0, 0, 0); // End of working day

//       if (today.getDate() === currentDate.getDate()) {
//         currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10);
//         currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0);
//       } else {
//         currentDate.setHours(10);
//         currentDate.setMinutes(0);
//       }

//       let timeSlots = [];
//       while (currentDate < endTime) {
//         let formattedTime = currentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

//         let day = currentDate.getDate();
//         let month = currentDate.getMonth() + 1;
//         let year = currentDate.getFullYear();
//         const slotDate = `${day}_${month}_${year}`;

//         // Check if slot is booked
//         let isBooked = docInfo.slots_booked?.[slotDate]?.includes(formattedTime) || false;

//         if (!isBooked) {
//           timeSlots.push({
//             datetime: new Date(currentDate),
//             time: formattedTime
//           });
//         }

//         // Move to next 30-minute slot
//         currentDate.setMinutes(currentDate.getMinutes() + 30);
//       }

//       if (timeSlots.length > 0) {
//         slots.push(timeSlots);
//       }
//     }

//     setDocSlots(slots); // Update available slots
//   };

//   const bookAppointments = async () => {
//     if (!token) {
//       toast.warn('Login to book an appointment');
//       return navigate('/login');
//     }
//     try {
//       const date = docSlots[slotIndex][0].datetime;

//       let day = date.getDate();
//       let month = date.getMonth() + 1;
//       let year = date.getFullYear();
//       const slotDate = `${day}_${month}_${year}`;

//       const { data } = await axios.post(
//         backendUrl + '/api/user/book-appointment',
//         { docId, slotDate, slotTime },
//         { headers: { token } }
//       );

//       if (data.success) {
//         toast.success(data.message);
//         getDoctorsData();
//         navigate('/my-appointments');
//       } else {
//         toast.error(data.message);
//       }
//     } catch (error) {
//       console.log(error);
//       toast.error(error.message);
//     }
//   };

//   useEffect(() => {
//     fetchDocInfo();
//   }, [doctors, docId]);

//   useEffect(() => {
//     getAvailableSlots();
//   }, [docInfo]);

//   return docInfo && (
//     <div>
//       {/* Doctor detail */}
//       <div className='flex flex-col sm:flex-row gap-4 '>
//         <div>
//           <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt='' />
//         </div>
//         <div className='flex-1 border border-gray-400 rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>
//           {/* Doc info : name degree exp */}
//           <p className='flex items-center gap-2 text-2xl font-medium text-gray-900'>
//             {docInfo.name}
//             <img className='w-5' src={assets.verified_icon} alt='' />
//           </p>
//           <div className='flex items-center gap-2 text-sm mt-1 text-gray-600'>
//             <p>{docInfo.degree} - {docInfo.speciality}</p>
//             <button className='py-0.5 px-2 border text-xs rounded-full'>{docInfo.experience}</button>
//           </div>
//           {/* Doctor about */}
//           <div>
//             <p className='flex items-center gap-1 text-sm font-medium text-gray-900 mt-3'>
//               About <img src={assets.info_icon} alt='' />
//             </p>
//             <p className='text-sm text-gray-500 max-w-[700px] mt-1'>{docInfo.about}</p>
//           </div>
//           <p className='text-gray-500 font-medium mt-4'>
//             Appointment fee: <span className='text-gray-900'>{currencySymbol}{docInfo.fees}</span>
//           </p>
//         </div>
//       </div>

//       {/* BOOKING SLOTS */}
//       <div className='sm:ml-72 sm:pl-4 mt-4 font-medium text-gray-700'>
//         <p>Booking slots</p>
//         <div className='flex gap-3 items-center w-full overflow-x-scroll mt-4'>
//           {
//             docSlots.length && docSlots.map((item, index) => (
//               <div onClick={() => setSlotIndex(index)}
//                 className={`text-center py-6 min-w-16 rounded-full cursor-pointer ${slotIndex === index ? 'bg-primary text-white' : 'border border-gray-200'}`} key={index}>
//                 <p>{item[0] && daysOfWeek[item[0].datetime.getDay()]}</p>
//                 <p>{item[0] && item[0].datetime.getDate()}</p>
//               </div>
//             ))
//           }
//         </div>
//         <div className='flex items-center gap-3 w-full overflow-x-scroll mt-4'>
//           {docSlots.length && docSlots[slotIndex]?.map((item, index) => (
//             <p onClick={() => setSlotTime(item.time)}
//               className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full cursor-pointer ${item.time === slotTime ? 'bg-primary text-white' : 'text-gray-400 border border-gray-300'}`}
//               key={index}>
//               {item.time.toLowerCase()}
//             </p>
//           ))}
//         </div>
//         <button onClick={bookAppointments} className='bg-primary text-white text-sm font-light px-14 py-3 rounded-full my-6'>
//           Book an appointment
//         </button>
//       </div>

//       {/* listing related doctors */}
//       <RelatedDoctors docId={docId} speciality={docInfo.speciality} />
//     </div>
//   );
// };

// export default Appointment;
