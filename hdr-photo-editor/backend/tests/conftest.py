import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Photo, Project


@pytest.fixture()
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture()
def project(db_session):
    project = Project(name="Test Project", group_range_seconds=3.0)
    db_session.add(project)
    db_session.commit()
    return project


def make_photo(db_session, project_id, brightness_ev=0.0, filename="photo.jpg"):
    photo = Photo(
        project_id=project_id,
        filename=filename,
        stored_path=f"/tmp/{filename}",
        brightness_ev=brightness_ev,
    )
    db_session.add(photo)
    db_session.commit()
    return photo
