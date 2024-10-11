import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

const ProgressBar = ({ progress }) => {
    return (
        <Box display="flex" alignItems="center" mb={2}>
            <Box width="100%" mr={1}>
                <LinearProgress variant="determinate" value={progress} />
            </Box>
            <Box minWidth={35}>
                <Typography variant="body2" color="text.secondary">{`${Math.round(progress)}%`}</Typography>
            </Box>
        </Box>
    );
};

export default ProgressBar;