from . import db
from datetime import datetime
import json


class GptResponse(db.Model):
    __tablename__ = 'gpt_responses'
    id = db.Column(db.Integer, primary_key=True)
    google_sheet_id = db.Column(db.Integer, db.ForeignKey('google_sheets.id'))
    product_name = db.Column(db.String(255))
    product_name_column = db.Column(db.String(255))
    analysis_column = db.Column(db.String(255))
    assistant_id = db.Column(db.String(255))
    original_text = db.Column(db.Text)
    analysis_date = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='pending')
    versions = db.relationship('GptResponseVersion', backref='gpt_response', lazy='dynamic')

    def __repr__(self):
        return f'<GptResponse {self.product_name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'product_name': self.product_name,
            'original_text': self.original_text,
            'analysis_date': self.analysis_date.isoformat(),
            'versions': [version.to_dict() for version in self.versions]
        }


class GptResponseVersion(db.Model):
    __tablename__ = 'gpt_response_versions'
    id = db.Column(db.Integer, primary_key=True)
    gpt_response_id = db.Column(db.Integer, db.ForeignKey('gpt_responses.id'))
    version_number = db.Column(db.Integer)
    improved_text = db.Column(db.Text)
    changes = db.Column(db.Text)
    prompt = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<GptResponseVersion {self.version_number}>'

    def to_dict(self):
        return {
            'version_number': self.version_number,
            'improved_text': self.improved_text,
            'changes': json.loads(self.changes),
            'prompt': self.prompt,
            'created_at': self.created_at.isoformat()
        }


class GoogleSheet(db.Model):
    __tablename__ = 'google_sheets'
    id = db.Column(db.Integer, primary_key=True)
    sheet_id = db.Column(db.String(64), unique=True, index=True)
    name = db.Column(db.String(64))
    url = db.Column(db.String(256))
    last_synced = db.Column(db.DateTime, default=datetime.utcnow)
    data = db.relationship('SheetData', backref='google_sheet', lazy='dynamic')

    def __repr__(self):
        return f'<GoogleSheet {self.name}>'


class SheetData(db.Model):
    __tablename__ = 'sheet_data'
    id = db.Column(db.Integer, primary_key=True)
    google_sheet_id = db.Column(db.Integer, db.ForeignKey('google_sheets.id'))
    row_index = db.Column(db.Integer)
    column_name = db.Column(db.String(64))
    data = db.Column(db.Text)
    gpt_suggestions = db.Column(db.Text)
    is_checked = db.Column(db.Boolean, default=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    analysis_result = db.Column(db.Text)  # New column for storing analysis results

    def set_analysis_result(self, result):
        self.analysis_result = json.dumps(result)

    def get_analysis_result(self):
        if self.analysis_result:
            return json.loads(self.analysis_result)
        return None

    def __repr__(self):
        return f'<SheetData {self.id}>'


class Feedback(db.Model):
    __tablename__ = 'feedbacks'
    id = db.Column(db.Integer, primary_key=True)
    gpt_response_id = db.Column(db.Integer, db.ForeignKey('gpt_responses.id'))
    feedback_text = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Feedback {self.id}>'
