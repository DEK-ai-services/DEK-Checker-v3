import React, { useState, useEffect } from 'react';
import { Typography, Box } from '@mui/material';

const Countdown = () => {
    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    function calculateTimeLeft() {
        const now = new Date();
        const targetTime = new Date(now);
        targetTime.setHours(23, 55, 0, 0);

        if (now > targetTime) {
            targetTime.setDate(targetTime.getDate() + 1);
        }

        const difference = targetTime - now;

        return {
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / 1000 / 60) % 60),
            seconds: Math.floor((difference / 1000) % 60)
        };
    }

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <Box textAlign="center" mt={2}>
            <Typography variant="h6">Čas do 23:55</Typography>
            <Typography variant="h4">
                {String(timeLeft.hours).padStart(2, '0')}:
                {String(timeLeft.minutes).padStart(2, '0')}:
                {String(timeLeft.seconds).padStart(2, '0')}
            </Typography>
        </Box>
    );
};

export default Countdown;