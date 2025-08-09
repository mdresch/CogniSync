from setuptools import setup, find_packages

setup(
    name='cogni-sync-client',
    version='0.1.0',
    description='Python client for CogniSync API integration',
    author='Your Name',
    packages=find_packages(),
    install_requires=[
        'requests'
    ],
    python_requires='>=3.7',
)
