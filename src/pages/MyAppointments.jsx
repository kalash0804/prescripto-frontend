import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'

const MyAppointments = () => {
  const { backendUrl, token, getDoctorsData } = useContext(AppContext)

  const [appointments, setAppointments] = useState([])
  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  const slotDateFormat = (slotDate) => {
    const dateArray = slotDate.split('_')
    return `${dateArray[0]} ${months[Number(dateArray[1])]} ${dateArray[2]}`
  }

  const getUserAppointments = async () => {
    try {
      const { data } = await axios.get(`${backendUrl}/api/user/my-appointments`, {
        headers: { token }
      })

      if (data.success && Array.isArray(data.appointments)) {
        setAppointments(data.appointments.reverse())
      }
    } catch (error) {
      console.error(error)
      toast.error(error.message || "Failed to fetch appointments")
    }
  }

  const cancelAppointment = async (appointmentId) => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/cancel-appointment`, { appointmentId }, {
        headers: { token }
      })

      if (data.success) {
        toast.success(data.message)
        getUserAppointments()
        getDoctorsData()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.message || "Error cancelling appointment")
    }
  }

  const initPay = (order) => {
    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: 'Appointment Payment',
      description: 'Appointment Payment',
      order_id: order.id,
      receipt: order.receipt,
      handler: async (response) => {
        console.log(response)
        // You can also notify the backend here
      }
    }

    const rzp = new window.Razorpay(options)
    rzp.open()
  }

  const appointmentRazorpay = async (appointmentId) => {
    try {
      const { data } = await axios.post(`${backendUrl}/api/user/payment-razorpay`, { appointmentId }, {
        headers: { token }
      })

      if (data.success) {
        initPay(data.order)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.error(error)
      toast.error(error.message || "Payment failed")
    }
  }

  useEffect(() => {
    if (token) getUserAppointments()
  }, [token])

  return (
    <div>
      <p className='pb-3 mt-12 font-medium text-zinc-700 border-b'>My Appointments</p>
      <div>
        {
          Array.isArray(appointments) && appointments.map((item, index) => {
            const doctor = item?.docData || {}
            const address = doctor?.address || {}

            return (
              <div className='grid grid-cols-[1fr_2fr] gap-4 sm:flex sm:gap-6 py-2 border-b' key={index}>
                <div>
                  <img className='w-32 bg-indigo-50' src={doctor.image || ''} alt="doctor" />
                </div>
                <div className='flex-1 text-sm text-zinc-600'>
                  <p className='text-neutral-800 font-semibold'>{doctor.name || 'Unknown Doctor'}</p>
                  <p>{doctor.speciality || 'Speciality Not Available'}</p>
                  <p className='text-zinc-700 font-medium mt-1'>Address:</p>
                  <p className='text-xs'>{address.line1 || 'N/A'}</p>
                  <p className='text-xs'>{address.line2 || 'N/A'}</p>
                  <p className='text-xs mt-1'>
                    <span className='text-sm text-neutral-700 font-medium'>Date & Time:</span>
                    {item.slotDate ? slotDateFormat(item.slotDate) : 'N/A'} | {item.slotTime || 'N/A'}
                  </p>
                </div>

                <div className='flex flex-col gap-2 justify-end'>
                  {!item.cancelled && (
                    <>
                      <button
                        onClick={() => appointmentRazorpay(item._id)}
                        className='text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-primary hover:text-white transition-all duration-300'>
                        Pay Online
                      </button>
                      <button
                        onClick={() => cancelAppointment(item._id)}
                        className='text-sm text-stone-500 text-center sm:min-w-48 py-2 border rounded hover:bg-red-600 hover:text-white transition-all duration-300'>
                        Cancel Appointment
                      </button>
                    </>
                  )}
                  {item.cancelled && (
                    <button className='sm:min-w-48 py-2 border border-red-500 rounded text-red-500'>
                      Appointment Cancelled
                    </button>
                  )}
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  )
}

export default MyAppointments
