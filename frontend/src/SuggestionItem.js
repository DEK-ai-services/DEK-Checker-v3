import React from 'react';
import { Paper, Typography, Button, Box } from '@mui/material';

const SuggestionItem = ({ suggestion, onAccept, onReject }) => {
    return (
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="body1" gutterBottom>
                <strong>Typ zmìny:</strong> {suggestion.type === 'delete' ? 'Odstranìní' : 'Zmìna'}
            </Typography>
            <Typography variant="body1" gutterBottom>
                <strong>Pùvodní:</strong> {suggestion.original}
            </Typography>
            {suggestion.type === 'change' && (
                <Typography variant="body1" gutterBottom>
                    <strong>Návrh:</strong> {suggestion.suggested}
                </Typography>
            )}
            <Typography variant="body2" gutterBottom>
                <strong>Kontext:</strong> {suggestion.context}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button onClick={() => onAccept(suggestion)} color="primary" variant="contained" sx={{ mr: 1 }}>
                    Pøijmout
                </Button>
                <Button onClick={() => onReject(suggestion)} color="secondary" variant="outlined">
                    Zamítnout
                </Button>
            </Box>
        </Paper>
    );
};

export default SuggestionItem;