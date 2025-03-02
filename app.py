import jwt
import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from flask_cors import CORS
from sqlalchemy import func
import os

app = Flask(__name__, static_folder='public')
CORS(app) 
BASEDIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] =  f"sqlite:///{os.path.join(BASEDIR, 'instance', 'lostloop.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = 'your_secret_key'
db = SQLAlchemy(app)

# ---------------------------
# Models
# ---------------------------

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    bio = db.Column(db.Text, default='')
    points = db.Column(db.Integer, default=0)
    profile_pic = db.Column(db.String(255), nullable=True)  # Optional profile picture URL
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
        
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    location = db.Column(db.String(255))
    imageUrl = db.Column(db.String(255))
    community_id = db.Column(db.Integer, db.ForeignKey('community.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    post_id = db.Column(db.Integer, db.ForeignKey('post.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Community(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text)
    logo = db.Column(db.String(255), nullable=True)  # Optional community logo URL
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class CommunityMembership(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    community_id = db.Column(db.Integer, db.ForeignKey('community.id'), nullable=False)

class Reward(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    recipient_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    message = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Follow(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    follower_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    followed_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

# ---------------------------
# JWT Helpers and Decorator
# ---------------------------
def generate_token(user_id):
    payload = {
        'user_id': user_id,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Token is missing!'}), 401
        parts = auth_header.split()
        token = parts[1] if len(parts) == 2 and parts[0].lower() == 'bearer' else auth_header
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = User.query.get(data['user_id'])
            if not current_user:
                return jsonify({'error': 'Invalid token!'}), 401
        except Exception as e:
            print("Token decoding error:", e)
            return jsonify({'error': 'Invalid token!'}), 401
        return f(current_user, *args, **kwargs)
    return decorated

# ---------------------------
# Authentication Endpoints
# ---------------------------
@app.route('/auth/register', methods=['POST'])
def register():
    data = request.json
    if not all(k in data for k in ('username', 'email', 'password')):
        return jsonify({'error': 'Invalid input'}), 400
    if User.query.filter((User.username == data['username']) | (User.email == data['email'])).first():
        return jsonify({'error': 'Username or email already taken'}), 400
    user = User(username=data['username'], email=data['email'])
    user.set_password(data['password'])
    # Optionally set profile picture URL if provided
    if 'profile_pic' in data and data['profile_pic']:
        user.profile_pic = data['profile_pic']
    db.session.add(user)
    db.session.commit()
    return jsonify({'message': 'Successfully created account'}), 201

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    if not all(k in data for k in ('email', 'password')):
        return jsonify({'error': 'Invalid input'}), 400
    user = User.query.filter_by(email=data['email']).first()
    if user and user.check_password(data['password']):
        token = generate_token(user.id)
        user_data = {
            'id': str(user.id),
            'username': user.username,
            'email': user.email,
            'profile_pic': user.profile_pic,
            'createdAt': user.created_at.isoformat()
        }
        return jsonify({'token': token, 'user': user_data})
    return jsonify({'error': 'Invalid credentials'}), 401

# ---------------------------
# User Endpoints
# ---------------------------
@app.route('/users/<string:userId>', methods=['GET'])
def get_user(userId):
    if userId == "me":
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'error': 'Token is missing!'}), 401
        parts = auth_header.split()
        token = parts[1] if len(parts) == 2 and parts[0].lower() == 'bearer' else auth_header
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            user = User.query.get(data['user_id'])
        except Exception as e:
            return jsonify({'error': 'Invalid token!'}), 401
    else:
        user = User.query.get(userId)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    user_data = {
        'id': str(user.id),
        'username': user.username,
        'email': user.email,
        'profile_pic': user.profile_pic,
        'createdAt': user.created_at.isoformat()
    }
    return jsonify(user_data), 200

@app.route('/users/<string:userId>', methods=['PUT'])
@token_required
def update_user(current_user, userId):
    if str(current_user.id) != userId:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if 'username' in data:
        current_user.username = data['username']
    if 'email' in data:
        current_user.email = data['email']
    if 'profile_pic' in data:  # Allow updating profile pic
        current_user.profile_pic = data['profile_pic']
    db.session.commit()
    return jsonify({'message': 'Profile updated successfully'}), 200

@app.route('/users/<string:userId>/posts', methods=['GET'])
def get_user_posts(userId):
    user = User.query.get(userId)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    posts = Post.query.filter_by(user_id=user.id).all()
    posts_data = []
    for post in posts:
        posts_data.append({
            'id': str(post.id),
            'title': post.title,
            'description': post.description,
            'location': post.location,
            'imageUrl': post.imageUrl,
            'createdAt': post.created_at.isoformat(),
            'updatedAt': post.updated_at.isoformat()
        })
    return jsonify(posts_data), 200

@app.route('/users/<string:userId>/follow', methods=['POST'])
@token_required
def follow_unfollow_user(current_user, userId):
    target = User.query.get(userId)
    if not target:
        return jsonify({'error': 'User not found'}), 404
    follow = Follow.query.filter_by(follower_id=current_user.id, followed_id=target.id).first()
    if follow:
        db.session.delete(follow)
        db.session.commit()
        return jsonify({'message': 'Unfollowed user successfully'}), 200
    else:
        new_follow = Follow(follower_id=current_user.id, followed_id=target.id)
        db.session.add(new_follow)
        db.session.commit()
        return jsonify({'message': 'Followed user successfully'}), 200

# ---------------------------
# Post Endpoints
# ---------------------------
@app.route('/posts', methods=['POST'])
@token_required
def create_post(current_user):
    data = request.json
    if not all(k in data for k in ('title', 'description')):
        return jsonify({'error': 'Invalid input'}), 400
    post = Post(
        user_id=current_user.id,
        title=data['title'],
        description=data['description'],
        location=data.get('location'),
        imageUrl=data.get('imageUrl'),
        community_id=data.get('community_id')
    )
    db.session.add(post)
    db.session.commit()
    post_data = {
        'id': str(post.id),
        'title': post.title,
        'description': post.description,
        'location': post.location,
        'imageUrl': post.imageUrl,
        'createdAt': post.created_at.isoformat(),
        'updatedAt': post.updated_at.isoformat()
    }
    return jsonify(post_data), 201

@app.route('/posts', methods=['GET'])
def get_posts():
    posts = Post.query.order_by(Post.created_at.desc()).all()
    posts_data = []
    for post in posts:
        user = User.query.get(post.user_id)  # fetch the user who created the post
        posts_data.append({
            'id': str(post.id),
            'title': post.title,
            'description': post.description,
            'location': post.location,
            'imageUrl': post.imageUrl,
            'createdAt': post.created_at.isoformat(),
            'updatedAt': post.updated_at.isoformat(),
            'user': {
                'id': str(user.id),
                'username': user.username,
                'profile_pic': user.profile_pic or ""  # fallback if null
            }
        })
    return jsonify(posts_data), 200


@app.route('/posts/<string:postId>', methods=['GET'])
def get_post(postId):
    post = Post.query.get(postId)
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    
    # Fetch the post owner
    owner = User.query.get(post.user_id)
    
    # Fetch all comments and include commenter data
    comments = Comment.query.filter_by(post_id=post.id).all()
    comments_data = []
    for comment in comments:
        comment_user = User.query.get(comment.user_id)
        comments_data.append({
            'id': str(comment.id),
            'content': comment.content,
            'postId': str(comment.post_id),
            'createdAt': comment.created_at.isoformat(),
            'user': {
                'id': str(comment_user.id),
                'username': comment_user.username,
                'profile_pic': comment_user.profile_pic or ""
            }
        })
    
    post_data = {
        'post': {
            'id': str(post.id),
            'title': post.title,
            'description': post.description,
            'location': post.location,
            'imageUrl': post.imageUrl,
            'createdAt': post.created_at.isoformat(),
            'updatedAt': post.updated_at.isoformat(),
            'owner': {
                'id': str(owner.id),
                'username': owner.username,
                'profile_pic': owner.profile_pic or ""
            }
        },
        'comments': comments_data
    }
    return jsonify(post_data), 200


@app.route('/posts/<string:postId>', methods=['PUT'])
@token_required
def update_post(current_user, postId):
    post = Post.query.get(postId)
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    if post.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    if 'title' in data:
        post.title = data['title']
    if 'description' in data:
        post.description = data['description']
    if 'location' in data:
        post.location = data['location']
    if 'imageUrl' in data:
        post.imageUrl = data['imageUrl']
    db.session.commit()
    return jsonify({'message': 'Post updated successfully'}), 200

@app.route('/posts/<string:postId>', methods=['DELETE'])
@token_required
def delete_post(current_user, postId):
    post = Post.query.get(postId)
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    if post.user_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 401
    db.session.delete(post)
    db.session.commit()
    return jsonify({'message': 'Successfully deleted post'}), 200

@app.route('/posts/<string:postId>/comments', methods=['POST'])
@token_required
def add_comment(current_user, postId):
    post = Post.query.get(postId)
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    data = request.json
    if 'content' not in data:
        return jsonify({'error': 'Invalid input'}), 400
    comment = Comment(content=data['content'], post_id=post.id, user_id=current_user.id)
    db.session.add(comment)
    db.session.commit()
    comment_data = {
        'id': str(comment.id),
        'content': comment.content,
        'postId': str(comment.post_id),
        'createdAt': comment.created_at.isoformat()
    }
    return jsonify(comment_data), 201

@app.route('/posts/search', methods=['GET'])
def search_posts():
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Invalid search query'}), 400
    posts = Post.query.filter(Post.title.ilike(f'%{query}%') | Post.description.ilike(f'%{query}%')).all()
    posts_data = []
    for post in posts:
        posts_data.append({
            'id': str(post.id),
            'title': post.title,
            'description': post.description,
            'location': post.location,
            'imageUrl': post.imageUrl,
            'createdAt': post.created_at.isoformat(),
            'updatedAt': post.updated_at.isoformat()
        })
    return jsonify(posts_data), 200

# ---------------------------
# Community Endpoints
# ---------------------------
@app.route('/communities', methods=['POST'])
@token_required
def create_community(current_user):
    data = request.json
    if not all(k in data for k in ('name', 'description')):
        return jsonify({'error': 'Invalid input'}), 400
    if Community.query.filter_by(name=data['name']).first():
        return jsonify({'error': 'Community name already exists'}), 400
    community = Community(name=data['name'], description=data['description'])
    # Optionally set community logo if provided
    if 'logo' in data and data['logo']:
        community.logo = data['logo']
    db.session.add(community)
    db.session.commit()
    community_data = {
        'id': str(community.id),
        'name': community.name,
        'description': community.description,
        'logo': community.logo,
        'createdAt': community.created_at.isoformat()
    }
    return jsonify(community_data), 201

@app.route('/communities', methods=['GET'])
def list_communities():
    communities = Community.query.all()
    communities_data = []
    for community in communities:
        communities_data.append({
            'id': str(community.id),
            'name': community.name,
            'description': community.description,
            'logo': community.logo,
            'createdAt': community.created_at.isoformat()
        })
    return jsonify(communities_data), 200

@app.route('/communities/<string:communityId>', methods=['GET'])
def get_community_details(communityId):
    community = Community.query.get(communityId)
    if not community:
        return jsonify({'error': 'Community not found'}), 404
    posts = Post.query.filter_by(community_id=community.id).all()
    posts_data = []
    for post in posts:
        posts_data.append({
            'id': str(post.id),
            'title': post.title,
            'description': post.description,
            'location': post.location,
            'imageUrl': post.imageUrl,
            'createdAt': post.created_at.isoformat(),
            'updatedAt': post.updated_at.isoformat()
        })
    community_data = {
        'community': {
            'id': str(community.id),
            'name': community.name,
            'description': community.description,
            'logo': community.logo,
            'createdAt': community.created_at.isoformat()
        },
        'posts': posts_data
    }
    return jsonify(community_data), 200

@app.route('/communities/<string:communityId>/join', methods=['POST'])
@token_required
def join_community(current_user, communityId):
    community = Community.query.get(communityId)
    if not community:
        return jsonify({'error': 'Community not found'}), 404
    membership = CommunityMembership.query.filter_by(user_id=current_user.id, community_id=community.id).first()
    if membership:
        return jsonify({'message': 'Already a member'}), 200
    membership = CommunityMembership(user_id=current_user.id, community_id=community.id)
    db.session.add(membership)
    db.session.commit()
    return jsonify({'message': 'Joined community successfully'}), 200

@app.route('/communities/<string:communityId>/exit', methods=['DELETE'])
@token_required
def exit_community(current_user, communityId):
    membership = CommunityMembership.query.filter_by(user_id=current_user.id, community_id=communityId).first()
    if not membership:
        return jsonify({'error': 'Not a member of this community'}), 400
    db.session.delete(membership)
    db.session.commit()
    return jsonify({'message': 'Exited community successfully'}), 200

# ---------------------------
# Reward System Endpoint
# ---------------------------
@app.route('/rewards/send', methods=['POST'])
@token_required
def send_reward(current_user):
    data = request.json
    if not all(k in data for k in ('recipientId', 'amount')):
        return jsonify({'error': 'Invalid input'}), 400
    recipient = User.query.get(data['recipientId'])
    if not recipient:
        return jsonify({'error': 'Recipient not found'}), 404
    amount = int(data['amount'])
    if amount <= 0:
        return jsonify({'error': 'Amount must be positive'}), 400
    recipient.points += amount
    reward = Reward(sender_id=current_user.id, recipient_id=recipient.id, amount=amount)
    db.session.add(reward)
    db.session.commit()
    return jsonify({'message': 'Successfully sent points'}), 200


@app.route('/rewards/<string:userId>', methods=['GET'])
def get_total_rewards(userId):
    # If the userId is "me", use the current user's id
    if userId == "me":
        user_id = current_user.id
    else:
        user_id = userId

    # Sum up the amounts for rewards received by the specified user
    total = db.session.query(func.sum(Reward.amount)).filter_by(recipient_id=user_id).scalar() or 0

    return jsonify({"total_reward": total}), 200



# ---------------------------
# Notifications Endpoint
# ---------------------------
@app.route('/notifications', methods=['GET'])
@token_required
def get_notifications(current_user):
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).all()
    notifications_data = []
    for note in notifications:
        notifications_data.append({
            'id': str(note.id),
            'message': note.message,
            'createdAt': note.created_at.isoformat()
        })
    return jsonify(notifications_data), 200

# ---------------------------
# Serving Frontend Files
# ---------------------------
@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('public', filename)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
