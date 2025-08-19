'''
This file contains functions to fetch and process planetary data from the JPL Horizons API.
'''
import requests
import re
import math
import json
from datetime import datetime, timedelta

"""
This function fetches the state vectors (position and velocity) of a specified planet
"""


def get_planet_data(planet: int) -> tuple[list, list]:
    # API endpoint for JPL Horizons to get state vectors
    url = (
        "https://ssd.jpl.nasa.gov/api/horizons.api"
        f"?format=json&COMMAND='{planet}'&EPHEM_TYPE='VECTORS'&VEC_TABLE=2"
        "&CENTER='500@10'&TLIST='2025-08-09%2000:00'"  # Sun-centered
    )
    response = requests.get(url)
    planet_data = response.json()

    result_text = planet_data['result']

    # Extract position and velocity vectors using regex
    pos_pattern = r"X\s*=\s*([\d.E+-]+)\s*Y\s*=\s*([\d.E+-]+)\s*Z\s*=\s*([\d.E+-]+)"
    vel_pattern = r"VX\s*=\s*([\d.E+-]+)\s*VY\s*=\s*([\d.E+-]+)\s*VZ\s*=\s*([\d.E+-]+)"

    pos_match = re.search(pos_pattern, result_text)
    vel_match = re.search(vel_pattern, result_text)

    # Check if both position and velocity were found
    if pos_match and vel_match:
        position = [float(x) for x in pos_match.groups()]
        velocity = [float(x) for x in vel_match.groups()]
        return position, velocity
    else:
        raise ValueError("Could not parse state vectors from JPL Horizons")


"""
This function propagates the orbit of a planet given its position and velocity vectors
"""


def propagate_orbit(position: list, velocity: list, step_days: int = 1) -> list:

    mu_sun = 1.32712440018e11  # km³/s²

    r_vec = position
    v_vec = velocity

    r = math.sqrt(sum(p**2 for p in r_vec))
    v = math.sqrt(sum(v**2 for v in v_vec))

    # Angular momentum vector
    h_vec = [
        r_vec[1]*v_vec[2] - r_vec[2]*v_vec[1],
        r_vec[2]*v_vec[0] - r_vec[0]*v_vec[2],
        r_vec[0]*v_vec[1] - r_vec[1]*v_vec[0]
    ]
    h = math.sqrt(sum(h**2 for h in h_vec))

    # Eccentricity vector
    e_vec = [
        ((v_vec[1]*h_vec[2] - v_vec[2]*h_vec[1]) / mu_sun) - (r_vec[0]/r),
        ((v_vec[2]*h_vec[0] - v_vec[0]*h_vec[2]) / mu_sun) - (r_vec[1]/r),
        ((v_vec[0]*h_vec[1] - v_vec[1]*h_vec[0]) / mu_sun) - (r_vec[2]/r)
    ]
    e = math.sqrt(sum(e**2 for e in e_vec))

    # Semi-major axis
    a = 1 / (2/r - v**2/mu_sun)

    # Orbital period (Kepler’s 3rd law)
    period_seconds = 2 * math.pi * math.sqrt(a**3 / mu_sun)
    period_days = int(period_seconds // 86400)  # convert to days

    # Inclination
    i = math.acos(h_vec[2]/h)

    # Node vector
    n_vec = [-h_vec[1], h_vec[0], 0]
    n = math.sqrt(n_vec[0]**2 + n_vec[1]**2)

    # RAAN
    raan = math.acos(n_vec[0]/n) if n != 0 else 0
    if n_vec[1] < 0:
        raan = 2*math.pi - raan

    # Argument of periapsis
    argp = math.acos((n_vec[0]*e_vec[0] + n_vec[1] *
                     e_vec[1])/(n*e)) if n != 0 and e > 1e-8 else 0
    if e_vec[2] < 0:
        argp = 2*math.pi - argp

    # True anomaly
    ta = math.acos((sum(e_vec[i]*r_vec[i]
                   for i in range(3))) / (e*r)) if e > 1e-8 else 0
    if sum(r_vec[i]*v_vec[i] for i in range(3)) < 0:
        ta = 2*math.pi - ta

    results = []
    start_date = datetime(2025, 8, 9)

    # Initial eccentric anomaly
    E = 2 * math.atan(math.sqrt((1-e)/(1+e)) * math.tan(ta/2)) if e < 1 else ta

    # Mean motion
    n_motion = math.sqrt(mu_sun / a**3)

    # loop in increments of step_days until full orbit
    num_steps = period_days // step_days
    for step in range(num_steps + 1):
        dt = step * step_days * 86400
        M = n_motion * dt + (E - e * math.sin(E))

        # Solve Kepler’s equation
        E_new = M
        for _ in range(5):
            E_new -= (E_new - e * math.sin(E_new) - M) / \
                (1 - e * math.cos(E_new))

        ta_new = 2 * math.atan(math.sqrt((1+e)/(1-e)) *
                               math.tan(E_new/2)) if e < 1 else M
        r_new = a * (1 - e * math.cos(E_new))

        # Perifocal coords
        x = r_new * math.cos(ta_new)
        y = r_new * math.sin(ta_new)
        z = 0

        # Rotate into 3D space
        x_inertial = (math.cos(raan)*math.cos(argp) - math.sin(raan)*math.sin(argp)*math.cos(i)) * x + \
                     (-math.cos(raan)*math.sin(argp) -
                      math.sin(raan)*math.cos(argp)*math.cos(i)) * y
        y_inertial = (math.sin(raan)*math.cos(argp) + math.cos(raan)*math.sin(argp)*math.cos(i)) * x + \
                     (-math.sin(raan)*math.sin(argp) +
                      math.cos(raan)*math.cos(argp)*math.cos(i)) * y
        z_inertial = (math.sin(i)*math.sin(argp)) * x + \
            (math.sin(i)*math.cos(argp)) * y

        results.append({
            "time": (start_date + timedelta(days=step * step_days)).isoformat() + "Z",
            "pos": [x_inertial, y_inertial, z_inertial]
        })

    return results


if __name__ == "__main__":
    # Planet IDs for JPL Horizons
    planet_ids = {
        "mercury": 199,
        "venus": 299,
        "earth": 399,
        "mars": 499,
        "jupiter": 599,
        "saturn": 699,
        "uranus": 799,
        "neptune": 899,
        "pluto": 999
    }

    # Step size (days between points) for each planet
    planet_step_days = {
        "mercury": 1,
        "venus": 1,
        "earth": 1,
        "mars": 1,
        "jupiter": 5,
        "saturn": 10,
        "uranus": 25,
        "neptune": 50,
        "pluto": 100
    }

    # Creating a json for each planet containing its orbital data
    for planet_name, planet_id in planet_ids.items():
        print(f"Fetching {planet_name}...")
        position, velocity = get_planet_data(planet_id)
        step_days = planet_step_days[planet_name]
        data = propagate_orbit(position, velocity, step_days=step_days)

        filename = f"{planet_name}_positions.json"
        with open(filename, "w") as f:
            json.dump(data, f, indent=2)

        print(f"Saved {filename} with {len(data)} points")
