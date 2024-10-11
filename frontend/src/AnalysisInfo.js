import React from 'react';
import { Box, Typography, Paper } from '@mui/material';

const AnalysisInfo = () => {
    return (
        <Paper elevation={3}>
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                p={4}
                textAlign="center"
            >
                <Typography variant="h5" gutterBottom>
                    Příprava analýzy
                </Typography>
                <Typography variant="body1" paragraph>
                    Pro zahájení analýzy prosím vyberte potřebné sloupce a asistenta:
                </Typography>
                <Box mb={2}>
                    <Typography variant="body2" color="textSecondary">
                        1. Vyberte sloupec s názvem produktu
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        2. Vyberte sloupec k analýze
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        3. Zvolte asistenta pro analýzu
                    </Typography>
                </Box>
                <Typography variant="body1">
                    Po výběru všech položek můžete spustit analýzu kliknutím na tlačítko "Odeslat data".
                </Typography>
            </Box>
        </Paper>
    );
};

export default AnalysisInfo;