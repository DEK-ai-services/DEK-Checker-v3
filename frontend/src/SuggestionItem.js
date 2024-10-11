import React from 'react';
import { Paper, Typography, Button, Box } from '@mui/material';

const SuggestionItem = ({ suggestion, onAccept, onReject }) => {
    return (
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
            <Typography variant="body1" gutterBottom>
                <strong>Typ zm�ny:</strong> {suggestion.type === 'delete' ? 'Odstran�n�' : 'Zm�na'}
            </Typography>
            <Typography variant="body1" gutterBottom>
                <strong>P�vodn�:</strong> {suggestion.original}
            </Typography>
            {suggestion.type === 'change' && (
                <Typography variant="body1" gutterBottom>
                    <strong>N�vrh:</strong> {suggestion.suggested}
                </Typography>
            )}
            <Typography variant="body2" gutterBottom>
                <strong>Kontext:</strong> {suggestion.context}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button onClick={() => onAccept(suggestion)} color="primary" variant="contained" sx={{ mr: 1 }}>
                    P�ijmout
                </Button>
                <Button onClick={() => onReject(suggestion)} color="secondary" variant="outlined">
                    Zam�tnout
                </Button>
            </Box>
        </Paper>
    );
};

export default SuggestionItem;