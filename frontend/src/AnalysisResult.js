import React, { useState } from 'react';
import { Card, CardContent, Typography, Button, Grid, Paper, Box, IconButton, TextField, Chip, Tooltip } from '@mui/material';
import { Check as CheckIcon, Close as CloseIcon, Edit as EditIcon, Save as SaveIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import FormattedText from './FormattedText';

const AnalysisCard = styled(Card)(({ theme }) => ({
    marginBottom: theme.spacing(2),
}));

const TextPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
}));

const ChangeChip = styled(Chip)(({ theme }) => ({
    margin: theme.spacing(0.5),
}));

const FadeInBox = styled(Box)(({ theme }) => ({
    animation: `fadeIn 500ms ${theme.transitions.easing.easeInOut}`,
    '@keyframes fadeIn': {
        '0%': {
            opacity: 0,
            transform: 'translateY(10px)',
        },
        '100%': {
            opacity: 1,
            transform: 'translateY(0)',
        },
    },
}));

const AnalysisResult = ({ result, onConfirm, onReject, onFeedback, onUpdate }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState('');
    const [currentVersion, setCurrentVersion] = useState(
        result.versions && result.versions.length > 0
            ? result.versions[result.versions.length - 1]
            : null
    );

    const renderChanges = (changes) => {
        if (!changes || changes.length === 0) {
            return (
                <FadeInBox mb={2} p={2} bgcolor="#ecfff3">
                    <Typography variant="subtitle2" gutterBottom>Žádný návrh opravy</Typography>
                </FadeInBox>
            );
        }

        return (
            <FadeInBox mb={2}>
                <Typography variant="subtitle2" gutterBottom>Návrh opravy:</Typography>
                {changes.map((change, index) => (
                    <ChangeChip
                        key={index}
                        label={`${change.original} → ${change.corrected}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                    />
                ))}
            </FadeInBox>
        );
    };

    const latestVersion = result.versions && result.versions.length > 0
        ? result.versions[result.versions.length - 1]
        : null;

    const hasChanges = currentVersion && currentVersion.changes && currentVersion.changes.length > 0;

    const removeTags = (text) => {
        return text.replace(/<[^>]+>/g, (match) => {
            const content = match.match(/>(.+?)</);
            return content ? content[1] : '';
        });
    };

    const handleEditClick = () => {
        setEditedText(removeTags(currentVersion.improved_text));
        setIsEditing(true);
    };

    const handleSaveEdit = () => {
        const updatedVersion = { ...currentVersion, improved_text: editedText };
        setCurrentVersion(updatedVersion);
        onUpdate(result.id, updatedVersion);
        setIsEditing(false);
    };

    return (
        <AnalysisCard variant="outlined">
            <CardContent>
                <FadeInBox>
                    <Typography variant="h6" gutterBottom>
                        {result.product_name.original || (typeof result.product_name === 'string' ? result.product_name : 'Neznámý produkt')}
                    </Typography>
                </FadeInBox>

                {currentVersion && (
                    <>
                        {renderChanges(currentVersion.changes)}

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <TextPaper elevation={3}>
                                    <Typography variant="subtitle2" gutterBottom>Původní text:</Typography>
                                    <Typography variant="body2">{result.product_description.original}</Typography>
                                </TextPaper>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextPaper elevation={3}>
                                    <Typography variant="subtitle2" gutterBottom>Návrh</Typography>
                                    {isEditing ? (
                                        <TextField
                                            fullWidth
                                            multiline
                                            rows={4}
                                            value={editedText}
                                            onChange={(e) => setEditedText(e.target.value)}
                                            variant="outlined"
                                        />
                                    ) : (
                                        <FormattedText text={currentVersion.improved_text} />
                                    )}
                                </TextPaper>
                            </Grid>
                        </Grid>

                        <FadeInBox>
                            <Typography variant="body2" color="textSecondary">
                                Asistent: {currentVersion.prompt}
                            </Typography>
                        </FadeInBox>
                    </>
                )}

                <FadeInBox sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="body2" color="textSecondary">
                        Verze: {latestVersion ? latestVersion.version_number : 'N/A'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            startIcon={<CloseIcon />}
                            onClick={() => onReject(result)}
                            color="secondary"
                            variant="outlined"
                        >
                            Zamítnout
                        </Button>
                        <Button
                            onClick={() => onFeedback(result)}
                            color="primary"
                            variant="outlined"
                        >
                            Feedback
                        </Button>
                        {isEditing ? (
                            <Button
                                startIcon={<SaveIcon />}
                                onClick={handleSaveEdit}
                                color="primary"
                                variant="contained"
                            >
                                Uložit
                            </Button>
                        ) : (
                            <>
                                <Button
                                    startIcon={<EditIcon />}
                                    onClick={handleEditClick}
                                    color="primary"
                                    variant="outlined"
                                >
                                    Upravit
                                </Button>
                                <Button
                                    startIcon={<CheckIcon />}
                                    onClick={() => onConfirm(result, latestVersion)}
                                    color="primary"
                                    variant="contained"
                                >
                                    Potvrdit
                                </Button>
                            </>
                        )}
                    </Box>
                </FadeInBox>
            </CardContent>
        </AnalysisCard>
    );
};

export default AnalysisResult;