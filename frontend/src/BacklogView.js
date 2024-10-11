import React from 'react';
import { Container, Typography, Card, CardContent, Box } from '@mui/material';
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles((theme) => ({
    backlogCard: {
        marginBottom: theme.spacing(2),
    },
}));

const BacklogView = ({ responses }) => {
    const classes = useStyles();

    if (!responses || responses.length === 0) {
        return (
            <Container maxWidth="lg">
                <Typography variant="h4" gutterBottom>Backlog GPT odpovědí</Typography>
                <Typography>Žádné odpovědi k zobrazení.</Typography>
            </Container>
        );
    }

    const safeJsonParse = (jsonString) => {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            console.error('Error parsing JSON:', error, 'String:', jsonString);
            return [];
        }
    };

    return (
        <Container maxWidth="lg">
            <Typography variant="h4" gutterBottom>Backlog GPT odpovědí</Typography>
            {responses.map((response) => (
                <Card key={response.id} className={classes.backlogCard}>
                    <CardContent>
                        <Typography variant="h6">{response.product_name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                            Datum analýzy: {new Date(response.analysis_date).toLocaleString()}
                        </Typography>
                        <Typography variant="subtitle1">Původní text:</Typography>
                        <Typography paragraph>{response.original_text}</Typography>
                        {response.versions && response.versions.map((version, index) => (
                            <div key={index}>
                                <Typography variant="subtitle1">Verze {version.version_number}:</Typography>
                                <Typography paragraph>{version.improved_text}</Typography>
                                <Typography variant="subtitle2">Změny:</Typography>
                                <ul>
                                    {safeJsonParse(version.changes).map((change, changeIndex) => (
                                        <li key={changeIndex}>
                                            {change.type}: "{change.original}" → "{change.corrected}"
                                            <br />
                                            Vysvětlení: {change.explanation}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        {response.feedbacks && response.feedbacks.map((feedback, index) => (
                            <Box key={index} mt={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
                                <Typography variant="subtitle2">Feedback:</Typography>
                                <Typography>{feedback.feedback_text}</Typography>
                                <Typography variant="caption" color="textSecondary">
                                    {new Date(feedback.created_at).toLocaleString()}
                                </Typography>
                            </Box>
                        ))}
                    </CardContent>
                </Card>
            ))}
        </Container>
    );
};

export default BacklogView;