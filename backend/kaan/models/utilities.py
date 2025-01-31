from sqlalchemy.orm.query import Query
from sqlalchemy import event
from datetime import datetime

""" @event.listens_for(Query, "before_compile", retval=True)
def no_deleted(query):
    entity_list = []

    for desc in query.column_descriptions:
        entity = desc['entity']

        if entity == User:
            limit, offset = query._limit_clause, query._offset_clause
            query = query.limit(None).offset(None)

            query = query.filter(entity.deleted_account == False)

            query = query.limit(limit).offset(offset)
    
    return query """

def get_elapsed_time(date_posted):
    date_dif = datetime.utcnow() - date_posted
    minutes = int(date_dif.total_seconds() / 60)
    hours = int(date_dif.total_seconds() / 3600)
    weeks = int(date_dif.total_seconds() / 604800)
    months = int(date_dif.total_seconds() / 2629743)
    years = int(datetime.utcnow().year - date_posted.year)

    if minutes < 1:
        text = "Just now"
        return text
    elif minutes >= 1 and hours < 1:
        text = f"{minutes} minutes ago"
        return text
    elif hours >= 1 and hours < 2:
        text = f"{hours} hour ago"
        return text
    elif hours >= 2 and hours < 24:
        text = f"{hours} hours ago"
        return text
    elif date_dif.days >= 1 and date_dif.days < 2:
        text = f"{date_dif.days} day ago"
        return text
    elif date_dif.days >= 2 and date_dif.days < 7:
        text = f"{date_dif.days} days ago"
        return text
    elif weeks >= 1 and weeks < 2:
        text = f"{weeks} week ago"
        return text
    elif weeks >= 2 and weeks < 31:
        text = f"{weeks} weeks ago"
        return text
    elif months >= 1 and months < 2:
        text = f"{months} month ago"
        return text
    elif months >= 2 and months < 12:
        text = f"{months} months ago"
        return text
    elif years >= 1 and years < 2:
        text = f"{years} year ago"
        return text
    elif years >= 2:
        text = f"{years} years ago"
        return text
